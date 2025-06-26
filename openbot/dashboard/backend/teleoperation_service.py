import subprocess
import threading
import queue
from datetime import datetime
import logging
import os
import pty
import select
import time
import json
import re
import sys

logger = logging.getLogger(__name__)

class TeleoperationService:
    def __init__(self):
        self.active_sessions = {}   # session_id -> session_data
        self.output_queues = {}     # session_id -> Queue
        self.active_processes = {}  # session_id -> (process, master_fd)
        self.cancelled_sessions = set()  # Track cancelled sessions
        self.last_table_output = {}  # Track last table output per session

    def _clean_ansi_codes(self, text: str) -> str:
        """Remove ANSI escape codes from text"""
        # Remove ANSI escape sequences
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)

    def _process_table_output(self, session_id: str, text: str) -> str:
        """Process table output to avoid repetition"""
        cleaned_text = self._clean_ansi_codes(text)
        
        # Skip empty lines
        if not cleaned_text.strip():
            return None
            
        # Check if this is a complete table (contains table separator and timing info)
        if '---------------------------' in cleaned_text and 'time:' in cleaned_text:
            # This is a complete table, store it and return it
            self.last_table_output[session_id] = cleaned_text
            return cleaned_text
        elif ('---------------------------' in cleaned_text or 
              '.pos' in cleaned_text or 
              'NAME' in cleaned_text or 
              'NORM' in cleaned_text or
              (cleaned_text.startswith('time:') and 'ms' in cleaned_text and '(' in cleaned_text)):
            # This is a table line or timing line, don't send it as individual output
            return None
        else:
            # For non-table output, return as is
            return cleaned_text

    async def start_teleoperation(self, leader_type: str, leader_port: str, leader_id: str,
                                  follower_type: str, follower_port: str, follower_id: str,
                                  cameras: list = None) -> str:
        """
        Start a teleoperation process using LeRobot command and return a session ID
        """
        try:
            session_id = f"{leader_id}_{follower_id}_teleop"

            # Clean up any existing session with the same ID
            if session_id in self.active_processes:
                logger.warning(f"Session {session_id} already exists, cleaning up")
                await self.stop_teleoperation(session_id)

            # Remove from cancelled sessions if it was there
            self.cancelled_sessions.discard(session_id)

            # Create output queue for this session
            self.output_queues[session_id] = queue.Queue()

            # Store session info
            self.active_sessions[session_id] = {
                "leader_type": leader_type,
                "leader_port": leader_port,
                "leader_id": leader_id,
                "follower_type": follower_type,
                "follower_port": follower_port,
                "follower_id": follower_id,
                "cameras": cameras or [],
                "status": "starting",
                "start_time": datetime.now(),
                "output": []
            }

            # Build the teleoperation command
            command = [
                sys.executable, "-m", "lerobot.teleoperate",
                f"--robot.type={follower_type}",
                f"--robot.port={follower_port}",
                f"--robot.id={follower_id}",
                f"--teleop.type={leader_type}",
                f"--teleop.port={leader_port}",
                f"--teleop.id={leader_id}"
            ]

            # Add camera configuration if cameras are provided
            if cameras and len(cameras) > 0:
                camera_config = {}
                for i, camera in enumerate(cameras):
                    camera_name = camera.get('name', f'camera_{i}')
                    camera_config[camera_name] = {
                        'type': camera.get('type', 'opencv'),
                        'index_or_path': camera.get('index', 0),
                        'width': camera.get('width', 1920),
                        'height': camera.get('height', 1080),
                        'fps': camera.get('fps', 30)
                    }
                
                camera_json = json.dumps(camera_config)
                command.append(f"--robot.cameras={camera_json}")
                command.append("--display_data=true")

            logger.info(f"Executing teleoperation command: {' '.join(command)}")

            # Use PTY for better interactive output handling
            master_fd, slave_fd = pty.openpty()

            process = subprocess.Popen(
                command,
                stdout=slave_fd,
                stderr=slave_fd,
                stdin=slave_fd,
                close_fds=True,
                env=dict(os.environ, 
                        PYTHONUNBUFFERED="1",  # Force Python to be unbuffered
                        TERM="xterm-256color",  # Set terminal type
                        FORCE_COLOR="1")  # Force color output
            )

            os.close(slave_fd)
            self.active_processes[session_id] = (process, master_fd)
            self._add_output(session_id, f"Teleoperation started for leader {leader_id} and follower {follower_id}")

            thread = threading.Thread(
                target=self._monitor_teleoperation_subprocess,
                args=(session_id,),
                daemon=True
            )
            thread.start()

            logger.info(f"Started teleoperation process for {session_id}")
            return session_id
        except Exception as e:
            logger.error(f"Failed to start teleoperation: {e}")
            raise

    def _monitor_teleoperation_subprocess(self, session_id: str):
        try:
            process, master_fd = self.active_processes[session_id]
            self.active_sessions[session_id]["status"] = "running"
            logger.info(f"Starting to monitor teleoperation (PTY) for {session_id}")
            last_output_time = time.time()
            table_buffer = []
            in_table = False
            
            while True:
                if process.poll() is not None:
                    logger.info(f"Process finished for {session_id}")
                    break
                ready, _, _ = select.select([master_fd], [], [], 0.05)
                if ready:
                    try:
                        data = os.read(master_fd, 4096)
                        if data:
                            text_data = data.decode('utf-8', errors='ignore')
                            lines = text_data.split('\n')
                            for line in lines:
                                line = line.strip()
                                if line:
                                    # Check if this line starts a new table
                                    if '---------------------------' in line:
                                        # If we were already in a table, send the previous one first
                                        if in_table and table_buffer:
                                            complete_table = '\n'.join(table_buffer)
                                            processed_table = self._process_table_output(session_id, complete_table)
                                            if processed_table is not None:
                                                self._add_output(session_id, processed_table)
                                        
                                        # Start of a new table
                                        in_table = True
                                        table_buffer = [line]
                                    elif in_table:
                                        # Continue accumulating table lines
                                        table_buffer.append(line)
                                        
                                        # Check if this looks like the end of a table (contains timing info)
                                        if 'time:' in line and 'ms' in line and '(' in line:
                                            # End of table, send complete table
                                            complete_table = '\n'.join(table_buffer)
                                            processed_table = self._process_table_output(session_id, complete_table)
                                            if processed_table is not None:
                                                self._add_output(session_id, processed_table)
                                            in_table = False
                                            table_buffer = []
                                        # Fallback: if we have a substantial table buffer and hit another separator, send it
                                        elif '---------------------------' in line and len(table_buffer) > 5:
                                            # We have a substantial table, send it
                                            complete_table = '\n'.join(table_buffer)
                                            processed_table = self._process_table_output(session_id, complete_table)
                                            if processed_table is not None:
                                                self._add_output(session_id, processed_table)
                                            in_table = False
                                            table_buffer = [line]  # Start new table with this line
                                    else:
                                        # Non-table output, process normally
                                        processed_line = self._process_table_output(session_id, line)
                                        if processed_line is not None:
                                            self._add_output(session_id, processed_line)
                            last_output_time = time.time()
                    except Exception as e:
                        logger.error(f"PTY read error for {session_id}: {e}")
                time.sleep(0.05)
            # Process has finished
            if process.poll() == 0:
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Teleoperation cancelled by user")
                    logger.info(f"Teleoperation cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "completed"
                    self._add_output(session_id, "Teleoperation completed successfully!")
                    logger.info(f"Teleoperation completed successfully for {session_id}")
            else:
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Teleoperation cancelled by user")
                    logger.info(f"Teleoperation cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "failed"
                    self._add_output(session_id, f"Teleoperation failed with exit code {process.poll()}")
                    logger.error(f"Teleoperation failed for {session_id} with exit code {process.poll()}")
        except Exception as e:
            error_msg = f"Teleoperation monitoring error: {str(e)}"
            logger.error(f"Teleoperation error for {session_id}: {e}")
            if session_id in self.active_sessions:
                self._add_output(session_id, error_msg)
                self.active_sessions[session_id]["status"] = "failed"
                self.active_sessions[session_id]["error"] = str(e)
            else:
                logger.warning(f"Session {session_id} was already cleaned up, skipping status update")

    def _add_output(self, session_id: str, message: str):
        if session_id in self.output_queues:
            timestamp = datetime.now().isoformat()
            output_data = {
                "timestamp": timestamp,
                "message": message
            }
            
            # Check if this is a table output
            if '---------------------------' in message:
                # For table outputs, only store in active_sessions, don't add to queue
                if session_id in self.active_sessions:
                    stored_output = self.active_sessions[session_id]["output"]
                    # Remove all previous table outputs from stored output
                    stored_output[:] = [line for line in stored_output if '---------------------------' not in line]
                    # Add the new table output
                    stored_output.append(message)
            else:
                # For non-table output, add to queue and stored output
                self.output_queues[session_id].put(output_data)
                if session_id in self.active_sessions:
                    self.active_sessions[session_id]["output"].append(message)
        else:
            logger.error(f"No output queue found for {session_id}")

    async def stop_teleoperation(self, session_id: str) -> bool:
        try:
            if session_id not in self.active_processes:
                logger.warning(f"No active process found for {session_id}")
                return False
            self.cancelled_sessions.add(session_id)
            logger.info(f"Marked session {session_id} as cancelled")
            process, master_fd = self.active_processes[session_id]
            if process.poll() is None:
                logger.info(f"Terminating process for {session_id}")
                process.terminate()
                try:
                    process.wait(timeout=5)
                except:
                    logger.warning(f"Force killing process for {session_id}")
                    process.kill()
                    process.wait(timeout=2)
            if session_id in self.active_processes:
                del self.active_processes[session_id]
            if session_id in self.output_queues:
                del self.output_queues[session_id]
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            if session_id in self.last_table_output:
                del self.last_table_output[session_id]
            logger.info(f"Stopped teleoperation process for {session_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to stop teleoperation {session_id}: {e}")
            return False

    async def is_running(self, session_id: str) -> bool:
        if session_id not in self.active_sessions:
            return False
        session = self.active_sessions[session_id]
        return session["status"] in ["starting", "running"]

    async def get_all_output(self, session_id: str):
        if session_id not in self.output_queues:
            return []
        outputs = []
        
        # Collect all outputs from the queue
        while not self.output_queues[session_id].empty():
            output_data = self.output_queues[session_id].get()
            outputs.append(output_data["message"])
        
        return outputs

    async def get_latest_table(self, session_id: str):
        """Get the latest table output for a session"""
        if session_id in self.last_table_output:
            return self.last_table_output[session_id]
        else:
            return None

# Global instance
teleoperation_service = TeleoperationService() 