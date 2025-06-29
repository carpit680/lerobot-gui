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

# Import the function to get HF environment variables
from backend.env_manager import get_hf_env_for_cli

logger = logging.getLogger(__name__)

class DatasetRecordingService:
    def __init__(self):
        self.active_sessions = {}   # session_id -> session_data
        self.output_queues = {}     # session_id -> Queue
        self.active_processes = {}  # session_id -> (process, master_fd)
        self.cancelled_sessions = set()  # Track cancelled sessions

    def _clean_ansi_codes(self, text: str) -> str:
        """Remove ANSI escape codes from text"""
        # Remove ANSI escape sequences
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)

    async def start_dataset_recording(self, 
                                    robot_type: str,
                                    robot_port: str,
                                    robot_id: str,
                                    teleop_type: str,
                                    teleop_port: str,
                                    teleop_id: str,
                                    cameras: list = None,
                                    display_data: bool = True,
                                    dataset_repo_id: str = None,
                                    num_episodes: int = 5,
                                    single_task: str = None,
                                    push_to_hub: bool = False,
                                    resume: bool = True,
                                    episode_time_s: int = 60,
                                    reset_time_s: int = 60) -> str:
        """
        Start a dataset recording process using LeRobot record command and return a session ID
        """
        try:
            session_id = f"{robot_id}_{teleop_id}_recording_{int(time.time())}"

            # Clean up any existing session with the same ID
            if session_id in self.active_processes:
                logger.warning(f"Session {session_id} already exists, cleaning up")
                await self.stop_dataset_recording(session_id)

            # Remove from cancelled sessions if it was there
            self.cancelled_sessions.discard(session_id)

            # Create output queue for this session
            self.output_queues[session_id] = queue.Queue()

            # Store session info
            self.active_sessions[session_id] = {
                "robot_type": robot_type,
                "robot_port": robot_port,
                "robot_id": robot_id,
                "teleop_type": teleop_type,
                "teleop_port": teleop_port,
                "teleop_id": teleop_id,
                "cameras": cameras or [],
                "dataset_repo_id": dataset_repo_id,
                "num_episodes": num_episodes,
                "single_task": single_task,
                "push_to_hub": push_to_hub,
                "resume": resume,
                "episode_time_s": episode_time_s,
                "reset_time_s": reset_time_s,
                "status": "starting",
                "start_time": datetime.now(),
                "output": []
            }

            # Build the recording command
            command = [
                sys.executable, "-m", "lerobot.record",
                f"--robot.type={robot_type}",
                f"--robot.port={robot_port}",
                f"--robot.id={robot_id}",
                f"--teleop.type={teleop_type}",
                f"--teleop.port={teleop_port}",
                f"--teleop.id={teleop_id}",
                f"--display_data={str(display_data).lower()}",
                f"--dataset.num_episodes={num_episodes}",
                f"--dataset.push_to_hub={str(push_to_hub).lower()}",
                f"--resume={str(resume).lower()}",
                f"--dataset.episode_time_s={episode_time_s}",
                f"--dataset.reset_time_s={reset_time_s}"
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

            # Add dataset repository ID if provided
            if dataset_repo_id:
                command.append(f"--dataset.repo_id={dataset_repo_id}")

            # Add single task if provided
            if single_task:
                command.append(f"--dataset.single_task={single_task}")

            logger.info(f"Executing dataset recording command: {' '.join(command)}")

            # Use PTY for better interactive output handling
            master_fd, slave_fd = pty.openpty()

            # Get environment variables for CLI commands
            cli_env = get_hf_env_for_cli()

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

            os.close(slave_fd)
            self.active_processes[session_id] = (process, master_fd)
            self._add_output(session_id, f"Dataset recording started for robot {robot_id} and teleop {teleop_id}")

            thread = threading.Thread(
                target=self._monitor_recording_subprocess,
                args=(session_id,),
                daemon=True
            )
            thread.start()

            logger.info(f"Started dataset recording process for {session_id}")
            return session_id
        except Exception as e:
            logger.error(f"Failed to start dataset recording: {e}")
            raise

    def _monitor_recording_subprocess(self, session_id: str):
        try:
            process, master_fd = self.active_processes[session_id]
            self.active_sessions[session_id]["status"] = "running"
            logger.info(f"Starting to monitor dataset recording (PTY) for {session_id}")
            
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
                                    # Clean ANSI codes and add to output
                                    cleaned_line = self._clean_ansi_codes(line)
                                    if cleaned_line:
                                        self._add_output(session_id, cleaned_line)
                    except Exception as e:
                        logger.error(f"PTY read error for {session_id}: {e}")
                time.sleep(0.05)
            
            # Process has finished
            if process.poll() == 0:
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Dataset recording cancelled by user")
                    logger.info(f"Dataset recording cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "completed"
                    self._add_output(session_id, "Dataset recording completed successfully!")
                    logger.info(f"Dataset recording completed successfully for {session_id}")
            else:
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Dataset recording cancelled by user")
                    logger.info(f"Dataset recording cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "failed"
                    self._add_output(session_id, f"Dataset recording failed with exit code {process.poll()}")
                    logger.error(f"Dataset recording failed for {session_id} with exit code {process.poll()}")
        except Exception as e:
            error_msg = f"Dataset recording monitoring error: {str(e)}"
            logger.error(f"Dataset recording error for {session_id}: {e}")
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
            self.output_queues[session_id].put(output_data)
            if session_id in self.active_sessions:
                self.active_sessions[session_id]["output"].append(message)
        else:
            logger.error(f"No output queue found for {session_id}")

    async def stop_dataset_recording(self, session_id: str) -> bool:
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
            logger.info(f"Stopped dataset recording process for {session_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to stop dataset recording {session_id}: {e}")
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

# Global instance
dataset_recording_service = DatasetRecordingService() 