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

class DatasetReplayService:
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

    async def start_dataset_replay(self, 
                                 robot_type: str,
                                 robot_port: str,
                                 robot_id: str,
                                 dataset_repo_id: str,
                                 episode: int = 0) -> str:
        """
        Start a dataset replay process using LeRobot replay command and return a session ID
        """
        try:
            session_id = f"{robot_id}_replay_{int(time.time())}"

            # Clean up any existing session with the same ID
            if session_id in self.active_processes:
                logger.warning(f"Session {session_id} already exists, cleaning up")
                await self.stop_dataset_replay(session_id)

            # Remove from cancelled sessions if it was there
            self.cancelled_sessions.discard(session_id)

            # Create output queue for this session
            self.output_queues[session_id] = queue.Queue()

            # Store session info
            self.active_sessions[session_id] = {
                "robot_type": robot_type,
                "robot_port": robot_port,
                "robot_id": robot_id,
                "dataset_repo_id": dataset_repo_id,
                "episode": episode,
                "status": "starting",
                "start_time": datetime.now(),
                "output": []
            }

            # Build the replay command
            command = [
                sys.executable, "-m", "lerobot.replay",
                f"--robot.type={robot_type}",
                f"--robot.port={robot_port}",
                f"--robot.id={robot_id}",
                f"--dataset.repo_id={dataset_repo_id}",
                f"--dataset.episode={episode}"
            ]

            logger.info(f"Executing dataset replay command: {' '.join(command)}")

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
            self._add_output(session_id, f"Dataset replay started for robot {robot_id} with dataset {dataset_repo_id}")

            thread = threading.Thread(
                target=self._monitor_replay_subprocess,
                args=(session_id,),
                daemon=True
            )
            thread.start()

            logger.info(f"Started dataset replay process for {session_id}")
            return session_id
        except Exception as e:
            logger.error(f"Failed to start dataset replay: {e}")
            raise

    def _monitor_replay_subprocess(self, session_id: str):
        try:
            process, master_fd = self.active_processes[session_id]
            self.active_sessions[session_id]["status"] = "running"
            logger.info(f"Starting to monitor dataset replay (PTY) for {session_id}")
            
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
                    self._add_output(session_id, "Dataset replay cancelled by user")
                    logger.info(f"Dataset replay cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "completed"
                    self._add_output(session_id, "Dataset replay completed successfully!")
                    logger.info(f"Dataset replay completed successfully for {session_id}")
            else:
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Dataset replay cancelled by user")
                    logger.info(f"Dataset replay cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "failed"
                    self._add_output(session_id, f"Dataset replay failed with exit code {process.poll()}")
                    logger.error(f"Dataset replay failed for {session_id} with exit code {process.poll()}")
        except Exception as e:
            error_msg = f"Dataset replay monitoring error: {str(e)}"
            logger.error(f"Dataset replay error for {session_id}: {e}")
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

    async def stop_dataset_replay(self, session_id: str) -> bool:
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
            logger.info(f"Stopped dataset replay process for {session_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to stop dataset replay {session_id}: {e}")
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
dataset_replay_service = DatasetReplayService() 