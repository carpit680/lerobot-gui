import os
import sys
import queue
import threading
import subprocess
import logging
from datetime import datetime
import pty
import select
import time

class MotorSetupService:
    def __init__(self):
        self.active_sessions = {}   # session_id -> session_data
        self.output_queues = {}     # session_id -> Queue
        self.active_processes = {}  # session_id -> (process, master_fd)
        self.cancelled_sessions = set()

    async def start_motor_setup(self, robot_type: str, port: str) -> str:
        try:
            session_id = f"{robot_type}_{port.replace('/', '_')}_{int(time.time())}"
            if session_id in self.active_processes:
                logging.warning(f"Session {session_id} already exists, cleaning up")
                await self.stop_motor_setup(session_id)
            self.cancelled_sessions.discard(session_id)
            self.output_queues[session_id] = queue.Queue()
            self.active_sessions[session_id] = {
                "robot_type": robot_type,
                "port": port,
                "status": "starting",
                "start_time": datetime.now(),
                "output": []
            }
            command = [
                sys.executable, "-u", "-m", "lerobot.setup_motors",
                f"--robot.type={robot_type}",
                f"--robot.port={port}"
            ]
            logging.info(f"Executing motor setup command: {' '.join(command)}")
            master_fd, slave_fd = pty.openpty()
            process = subprocess.Popen(
                command,
                stdout=slave_fd,
                stderr=slave_fd,
                stdin=slave_fd,
                close_fds=True,
                env=dict(os.environ, PYTHONUNBUFFERED="1", TERM="xterm-256color", FORCE_COLOR="1")
            )
            os.close(slave_fd)
            self.active_processes[session_id] = (process, master_fd)
            self._add_output(session_id, f"Motor setup started for {robot_type} on port {port}")
            thread = threading.Thread(
                target=self._monitor_motor_setup_subprocess,
                args=(session_id,),
                daemon=True
            )
            thread.start()
            logging.info(f"Started motor setup process for {session_id}")
            return session_id
        except Exception as e:
            logging.error(f"Failed to start motor setup: {e}")
            raise

    def _add_output(self, session_id, output):
        if session_id in self.output_queues:
            self.output_queues[session_id].put(output)
        if session_id in self.active_sessions:
            self.active_sessions[session_id]["output"].append(output)

    def _monitor_motor_setup_subprocess(self, session_id: str):
        try:
            process, master_fd = self.active_processes[session_id]
            self.active_sessions[session_id]["status"] = "running"
            logging.info(f"Starting to monitor motor setup (PTY) for {session_id}")
            waiting_detected = False
            while True:
                rlist, _, _ = select.select([master_fd], [], [], 0.1)
                if master_fd in rlist:
                    try:
                        output = os.read(master_fd, 1024).decode(errors='replace')
                        if output:
                            self._add_output(session_id, output)
                            logging.info(f"Motor setup output: {output.rstrip()}")
                            if any(trigger in output.lower() for trigger in ["press enter", "hit enter", "press <enter>", "press return"]):
                                waiting_detected = True
                                self.active_sessions[session_id]["waiting_for_input"] = True
                    except OSError:
                        break
                if process.poll() is not None:
                    break
                time.sleep(0.01)
            if process.poll() == 0:
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Motor setup cancelled by user")
                    logging.info(f"Motor setup cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "completed"
                    self._add_output(session_id, "Motor setup completed successfully!")
                    logging.info(f"Motor setup completed successfully for {session_id}")
            else:
                if session_id in self.cancelled_sessions:
                    self._add_output(session_id, "Motor setup cancelled by user")
                    logging.info(f"Motor setup cancelled by user for {session_id}")
                else:
                    if session_id in self.active_sessions:
                        self.active_sessions[session_id]["status"] = "failed"
                    self._add_output(session_id, f"Motor setup failed with exit code {process.poll()}")
                    logging.error(f"Motor setup failed for {session_id} with exit code {process.poll()}")
        except Exception as e:
            logging.error(f"Error monitoring motor setup for {session_id}: {e}")

    async def get_all_output(self, session_id: str):
        outputs = []
        if session_id in self.output_queues:
            while not self.output_queues[session_id].empty():
                outputs.append(self.output_queues[session_id].get())
        return outputs

    async def is_running(self, session_id: str) -> bool:
        if session_id not in self.active_sessions:
            return False
        session = self.active_sessions[session_id]
        return session["status"] in ["starting", "running"]

    async def is_waiting_for_input(self, session_id: str) -> bool:
        if session_id not in self.active_sessions:
            return False
        session = self.active_sessions[session_id]
        return session.get("waiting_for_input", False)

    async def send_input(self, session_id: str, input_data: str) -> bool:
        try:
            if session_id not in self.active_processes:
                logging.warning(f"No active process found for {session_id}")
                return False
            process, master_fd = self.active_processes[session_id]
            if process.poll() is not None:
                logging.warning(f"Process for {session_id} is not running")
                return False
            os.write(master_fd, input_data.encode())
            if session_id in self.active_sessions:
                self.active_sessions[session_id]["waiting_for_input"] = False
            logging.info(f"Sent input to motor setup process for {session_id}")
            return True
        except Exception as e:
            logging.error(f"Failed to send input to motor setup {session_id}: {e}")
            return False

    async def stop_motor_setup(self, session_id: str) -> bool:
        try:
            if session_id not in self.active_processes:
                logging.warning(f"No active process found for {session_id}")
                return False
            self.cancelled_sessions.add(session_id)
            logging.info(f"Marked session {session_id} as cancelled")
            process, master_fd = self.active_processes[session_id]
            if process.poll() is None:
                logging.info(f"Terminating process for {session_id}")
                process.terminate()
                try:
                    process.wait(timeout=5)
                except:
                    logging.warning(f"Force killing process for {session_id}")
                    process.kill()
                    process.wait(timeout=2)
            if session_id in self.active_processes:
                del self.active_processes[session_id]
            if session_id in self.output_queues:
                del self.output_queues[session_id]
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            logging.info(f"Stopped motor setup process for {session_id}")
            return True
        except Exception as e:
            logging.error(f"Failed to stop motor setup {session_id}: {e}")
            return False 