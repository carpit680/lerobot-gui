import os
import re
from pathlib import Path
from typing import Dict, Any, Optional
import logging
import threading
import queue
import subprocess
from datetime import datetime
import sys

# Import the function to get HF environment variables
from backend.env_manager import get_hf_env_for_cli

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_ansi_codes(text: str) -> str:
    """
    Remove ANSI escape codes from text
    """
    # Remove ANSI escape codes including cursor movement
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    cleaned = ansi_escape.sub('', text)
    
    # Remove carriage returns and normalize line endings
    cleaned = cleaned.replace('\r', '')
    
    # Remove specific problematic patterns
    cleaned = re.sub(r'\[8A', '', cleaned)  # Remove cursor up 8 lines
    cleaned = re.sub(r'\[K', '', cleaned)   # Remove clear line
    cleaned = re.sub(r'\[2K', '', cleaned)  # Remove clear entire line
    
    # Clean up excessive whitespace
    cleaned = re.sub(r'\n\s*\n', '\n', cleaned)  # Remove empty lines
    cleaned = cleaned.strip()
    
    return cleaned

class CalibrationService:
    def __init__(self):
        self.active_sessions = {}   # session_id -> session_data
        self.output_queues = {}     # session_id -> Queue
        self.active_processes = {}  # session_id -> (process, master_fd)
        self._calibration_phases = {}  # session_id -> current_phase
        self.cancelled_sessions = set()  # Track cancelled sessions
    
    async def start_calibration(self, arm_type: str, robot_type: str, port: str, robot_id: str) -> str:
        """
        Start a calibration process using LeRobot command and return a session ID
        """
        try:
            session_id = f"{robot_id}_{arm_type}"
            
            # Clean up any existing session with the same ID
            if session_id in self.active_processes:
                logger.warning(f"Session {session_id} already exists, cleaning up")
                await self.stop_calibration(session_id)
            
            # Remove from cancelled sessions if it was there
            self.cancelled_sessions.discard(session_id)
            
            # Create output queue for this session
            self.output_queues[session_id] = queue.Queue()
            
            # Store session info
            self.active_sessions[session_id] = {
                "arm_type": arm_type,
                "robot_type": robot_type,
                "port": port,
                "robot_id": robot_id,
                "status": "starting",
                "start_time": datetime.now(),
                "output": []
            }
            
            # Build the calibration command
            if arm_type == 'leader':
                command = [
                    sys.executable, "-m", "lerobot.calibrate",
                    f"--teleop.type={robot_type.lower().replace('Follower', '_follower').replace('Leader', '_leader')}",
                    f"--teleop.port={port}",
                    f"--teleop.id={robot_id}"
                ]
            else:
                command = [
                    sys.executable, "-m", "lerobot.calibrate",
                    f"--robot.type={robot_type.lower().replace('Follower', '_follower').replace('Leader', '_leader')}",
                    f"--robot.port={port}",
                    f"--robot.id={robot_id}"
                ]
            
            # Log the command for debugging
            logger.info(f"Executing calibration command: {' '.join(command)}")
            
            # Use PTY for better interactive output handling
            import pty
            import os
            
            # Create a PTY
            master_fd, slave_fd = pty.openpty()
            
            # Get environment variables for CLI commands
            cli_env = get_hf_env_for_cli()
            
            # Start the process with PTY
            process = subprocess.Popen(
                command,
                stdout=slave_fd,
                stderr=slave_fd,
                stdin=slave_fd,
                close_fds=True,
                env=dict(os.environ, 
                        PYTHONUNBUFFERED="1",  # Force Python to be unbuffered
                        TERM="xterm-256color",  # Set terminal type
                        FORCE_COLOR="1",  # Force color output
                        **cli_env)  # Add Hugging Face credentials
            )
            
            # Close the slave fd in the parent
            os.close(slave_fd)
            
            # Store the process and master fd
            self.active_processes[session_id] = (process, master_fd)
            
            # Add initial output
            self._add_output(session_id, f"Calibration started for {robot_id} on port {port}")
            
            # Start monitoring in a separate thread
            thread = threading.Thread(
                target=self._monitor_calibration_subprocess,
                args=(session_id,),
                daemon=True
            )
            thread.start()
            
            logger.info(f"Started calibration process for {session_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to start calibration: {e}")
            raise
    
    def _monitor_calibration_subprocess(self, session_id: str):
        """
        Monitor the calibration process and handle output using PTY
        """
        try:
            process, master_fd = self.active_processes[session_id]
            self.active_sessions[session_id]["status"] = "running"
            logger.info(f"Starting to monitor calibration (PTY) for {session_id}")
            import select
            import time
            import os
            last_output_time = time.time()
            waiting_detected = False
            start_time = time.time()
            no_output_count = 0
            initial_wait_time = 3.0  # Increased to 3 seconds
            
            # Initialize calibration phase tracking
            if not hasattr(self, '_calibration_phases'):
                self._calibration_phases = {}
            self._calibration_phases[session_id] = "initial"  # initial, first_step, second_step, waiting
            
            while True:
                # Check if process is still running
                if process.poll() is not None:
                    logger.info(f"Process finished for {session_id}")
                    break
                
                # Try to read output without blocking
                ready, _, _ = select.select([master_fd], [], [], 0.05)  # Reduced timeout
                if ready:
                    try:
                        # Read all available data
                        data = os.read(master_fd, 4096)  # Read up to 4KB
                        if data:
                            # Decode the data
                            text_data = data.decode('utf-8', errors='ignore')
                            # Split into lines and process each
                            lines = text_data.split('\n')
                            for line in lines:
                                line = line.strip()
                                if line:
                                    # Clean ANSI escape codes
                                    line = clean_ansi_codes(line)
                                    logger.info(f"PTY Output from {session_id}: {line}")
                                    
                                    # Check if this is a traceback or error
                                    if "traceback" in line.lower() or "error" in line.lower() or "exception" in line.lower():
                                        logger.warning(f"Detected error/traceback in {session_id}: {line}")
                                        self._add_output(session_id, f"ERROR: {line}")
                                    else:
                                        self._add_output(session_id, line)
                                    
                                    # State machine for calibration phases
                                    line_lower = line.lower()
                                    current_phase = self._calibration_phases.get(session_id, "initial")
                                    
                                    if current_phase == "initial":
                                        # Look for first step instructions
                                        if "move test" in line_lower and "middle of its range" in line_lower:
                                            logger.info(f"Transitioning to first_step phase for {session_id}")
                                            self._calibration_phases[session_id] = "first_step"
                                            # Don't set waiting yet - let user see first step
                                    
                                    elif current_phase == "first_step":
                                        # Look for second step instructions
                                        if "move all joints" in line_lower and "entire ranges" in line_lower:
                                            logger.info(f"Transitioning to second_step phase for {session_id}")
                                            self._calibration_phases[session_id] = "second_step"
                                            # Now set waiting for input - this is when the process actually waits
                                            self.active_sessions[session_id]["waiting_for_input"] = True
                                            logger.info(f"Set waiting_for_input=True for {session_id} after seeing second step")
                                    
                                    # Also detect explicit "press enter" prompts in any phase
                                    if any(phrase in line_lower for phrase in [
                                        "press enter....", "press enter to stop", "press enter to continue"
                                    ]):
                                        logger.info(f"Detected explicit waiting for input in {session_id}: '{line}'")
                                        self.active_sessions[session_id]["waiting_for_input"] = True
                                        self._calibration_phases[session_id] = "waiting"
                            
                            last_output_time = time.time()
                            waiting_detected = False
                            no_output_count = 0
                                
                    except Exception as e:
                        logger.error(f"PTY read error for {session_id}: {e}")
                else:
                    # No output available, check if we should assume waiting for input
                    current_time = time.time()
                    no_output_count += 1
                    
                    # If no output for initial_wait_time seconds, assume waiting for input
                    if not waiting_detected and (current_time - last_output_time) > initial_wait_time:
                        logger.info(f"Detected waiting for input in {session_id} (no output for {initial_wait_time}+ seconds)")
                        self.active_sessions[session_id]["waiting_for_input"] = True
                        waiting_detected = True
                        # Add a message to indicate we're waiting for input
                        self._add_output(session_id, "Waiting for user input...")
                    
                    # If still no output after 3 seconds, add a status message
                    elif waiting_detected and no_output_count % 60 == 0:  # Every 3 seconds (60 * 0.05)
                        logger.info(f"Still waiting for output from {session_id} (no output for {current_time - last_output_time:.1f} seconds)")
                        self._add_output(session_id, "Still waiting for calibration process...")
                
                time.sleep(0.05)  # Reduced sleep time
            
            # Process has finished
            if process.poll() == 0:
                # Check if session was cancelled by user
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Calibration cancelled by user")
                    logger.info(f"Calibration cancelled by user for {session_id}")
                else:
                    # Update session status to completed
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "completed"
                    self._add_output(session_id, "Calibration completed successfully!")
                    logger.info(f"Calibration completed successfully for {session_id}")
            else:
                # Check if session was cancelled by user
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Calibration cancelled by user")
                    logger.info(f"Calibration cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "failed"
                    self._add_output(session_id, f"Calibration failed with exit code {process.poll()}")
                    logger.error(f"Calibration failed for {session_id} with exit code {process.poll()}")
                
        except Exception as e:
            error_msg = f"Calibration monitoring error: {str(e)}"
            logger.error(f"Calibration error for {session_id}: {e}")
            
            # Check if session still exists before trying to update it
            if session_id in self.active_sessions:
                self._add_output(session_id, error_msg)
                self.active_sessions[session_id]["status"] = "failed"
                self.active_sessions[session_id]["error"] = str(e)
            else:
                logger.warning(f"Session {session_id} was already cleaned up, skipping status update")
    
    def _add_output(self, session_id: str, message: str):
        """
        Add output message to the session queue
        """
        if session_id in self.output_queues:
            timestamp = datetime.now().isoformat()
            output_data = {
                "timestamp": timestamp,
                "message": message
            }
            self.output_queues[session_id].put(output_data)
            
            # Check if session still exists before updating it
            if session_id in self.active_sessions:
                self.active_sessions[session_id]["output"].append(message)
                queue_size = self.output_queues[session_id].qsize()
                logger.info(f"Added output to queue for {session_id} at {timestamp}: {message[:100]}{'...' if len(message) > 100 else ''} (queue size: {queue_size})")
            else:
                logger.warning(f"Session {session_id} was cleaned up, skipping output update")
        else:
            logger.error(f"No output queue found for {session_id}")
    
    async def send_input(self, session_id: str, input_data: str = "\n") -> bool:
        """
        Send input to an active calibration process
        """
        try:
            if session_id not in self.active_processes:
                return False
            
            process, master_fd = self.active_processes[session_id]
            if process.poll() is None:  # Process is still running
                os.write(master_fd, input_data.encode())
                
                # Clear waiting flag and reset phase
                if session_id in self.active_sessions:
                    self.active_sessions[session_id]["waiting_for_input"] = False
                
                # Reset calibration phase to allow next step detection
                if hasattr(self, '_calibration_phases') and session_id in self._calibration_phases:
                    current_phase = self._calibration_phases[session_id]
                    if current_phase == "second_step":
                        # Move to next phase after sending input
                        self._calibration_phases[session_id] = "next_phase"
                    elif current_phase == "waiting":
                        # Reset to allow new step detection
                        self._calibration_phases[session_id] = "initial"
                
                logger.info(f"Input sent to {session_id}, cleared waiting state")
                return True
            else:
                return False
                
        except Exception as e:
            logger.error(f"Failed to send input to {session_id}: {e}")
            return False
    
    async def get_output(self, session_id: str) -> Optional[str]:
        """
        Get the latest output from a calibration process
        """
        try:
            if session_id not in self.output_queues:
                logger.debug(f"No output queue found for {session_id}")
                return None
            
            output_queue = self.output_queues[session_id]
            
            # Try to get the latest output without blocking
            try:
                output = output_queue.get_nowait()
                logger.debug(f"Retrieved output for {session_id}: {output['message']}")
                return output["message"]
            except queue.Empty:
                logger.debug(f"No output available for {session_id}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get output from {session_id}: {e}")
            return None
    
    async def get_all_output(self, session_id: str) -> list[str]:
        """
        Get all available output messages from a calibration process
        """
        try:
            if session_id not in self.output_queues:
                logger.debug(f"No output queue found for {session_id}")
                return []
            
            output_queue = self.output_queues[session_id]
            outputs = []
            
            # Get all available output without blocking
            while True:
                try:
                    output = output_queue.get_nowait()
                    outputs.append(output["message"])
                    logger.debug(f"Retrieved output for {session_id}: {output['message']}")
                except queue.Empty:
                    break
            
            return outputs
                
        except Exception as e:
            logger.error(f"Failed to get output from {session_id}: {e}")
            return []
    
    async def is_running(self, session_id: str) -> bool:
        """
        Check if a calibration process is still running
        """
        if session_id not in self.active_sessions:
            return False
        
        session = self.active_sessions[session_id]
        return session["status"] in ["starting", "running"]
    
    async def is_waiting_for_input(self, session_id: str) -> bool:
        """
        Check if a calibration process is waiting for user input
        """
        if session_id not in self.active_sessions:
            return False
        
        session = self.active_sessions[session_id]
        return session.get("waiting_for_input", False)
    
    async def stop_calibration(self, session_id: str) -> bool:
        """
        Stop a calibration process
        """
        try:
            if session_id not in self.active_processes:
                logger.warning(f"No active process found for {session_id}")
                return False
            
            # Mark session as cancelled
            self.cancelled_sessions.add(session_id)
            logger.info(f"Marked session {session_id} as cancelled")
            
            process, master_fd = self.active_processes[session_id]
            if process.poll() is None:  # Process is still running
                logger.info(f"Terminating process for {session_id}")
                process.terminate()
                
                # Wait for graceful termination
                try:
                    process.wait(timeout=5)
                except:
                    # If graceful termination fails, force kill
                    logger.warning(f"Force killing process for {session_id}")
                    process.kill()
                    process.wait(timeout=2)
            
            # Clean up all session data
            if session_id in self.active_processes:
                del self.active_processes[session_id]
            if session_id in self.output_queues:
                del self.output_queues[session_id]
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            if hasattr(self, '_calibration_phases') and session_id in self._calibration_phases:
                del self._calibration_phases[session_id]
            
            logger.info(f"Stopped calibration process for {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop calibration {session_id}: {e}")
            return False
    
    async def check_calibration_files(self, robot_id: str, arm_type: str = "follower") -> Dict[str, Any]:
        """
        Check if calibration files exist for a given robot ID and arm type
        """
        # Determine the correct directory based on arm type
        if arm_type == "leader":
            cache_dir = Path.home() / ".cache" / "huggingface" / "lerobot" / "calibration" / "teleoperators"
        else:
            cache_dir = Path.home() / ".cache" / "huggingface" / "lerobot" / "calibration" / "robots"
        
        try:
            files = []
            
            if cache_dir.exists():
                # Recursively search through subdirectories
                patterns = [
                    f"*{robot_id}*",
                ]
                
                for pattern in patterns:
                    # Search recursively through all subdirectories
                    for file in cache_dir.rglob(pattern):
                        if file.is_file() and file not in [f["path"] for f in files]:
                            files.append({
                                "name": file.name,
                                "path": str(file),
                                "size": file.stat().st_size,
                                "modified": file.stat().st_mtime
                            })
            else:
                logger.warning(f"Cache directory does not exist: {cache_dir}")
            
            return {
                "robot_id": robot_id,
                "arm_type": arm_type,
                "cache_directory": str(cache_dir),
                "files": files,
                "file_count": len(files)
            }
            
        except Exception as e:
            logger.error(f"Failed to check calibration files: {e}")
            return {
                "robot_id": robot_id,
                "arm_type": arm_type,
                "cache_directory": str(cache_dir),
                "files": [],
                "file_count": 0,
                "error": str(e)
            }
    
    async def list_ports(self) -> Dict[str, Any]:
        """
        List available USB ports
        """
        try:
            ports = []
            
            # Check common USB port patterns
            common_patterns = [
                "/dev/ttyUSB*",
                "/dev/ttyACM*", 
                "/dev/tty.*",
            ]
            
            for pattern in common_patterns:
                import glob
                found_ports = glob.glob(pattern)
                ports.extend(found_ports)
            
            return {
                "ports": ports,
                "count": len(ports)
            }
            
        except Exception as e:
            logger.error(f"Failed to list ports: {e}")
            return {
                "ports": [],
                "count": 0,
                "error": str(e)
            }

# Global instance
calibration_service = CalibrationService() 