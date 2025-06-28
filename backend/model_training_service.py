import subprocess
import threading
import time
import os
import signal
import json
import asyncio
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import re

@dataclass
class TrainingConfig:
    dataset_repo_id: str
    policy_type: str
    output_dir: str
    job_name: str
    policy_device: str
    wandb_enable: bool
    resume: bool

class ModelTrainingService:
    def __init__(self):
        self.current_process: Optional[asyncio.subprocess.Process] = None
        self.output_buffer: List[str] = []
        self.is_running = False
        self.is_completed = False
        self.error_message: Optional[str] = None
        self.start_time: Optional[datetime] = None
        self.output_task: Optional[asyncio.Task] = None

    def start_training(self, config: TrainingConfig, token: Optional[str] = None) -> Dict:
        """Start the LeRobot training process"""
        if self.is_running:
            return {"error": "Training is already running"}

        try:
            # Reset state
            self.output_buffer = []
            self.is_running = True
            self.is_completed = False
            self.error_message = None
            self.start_time = datetime.now()

            # Build the command
            cmd = [
                "python", "-m", "lerobot.scripts.train",
                f"--dataset.repo_id={config.dataset_repo_id}",
                f"--policy.type={config.policy_type}",
                f"--output_dir={config.output_dir}",
                f"--job_name={config.job_name}",
                f"--policy.device={config.policy_device}",
                f"--wandb.enable={'true' if config.wandb_enable else 'false'}",
                f"--resume={'true' if config.resume else 'false'}"
            ]

            # If resuming, add checkpoint path
            if config.resume:
                checkpoint_path = os.path.join(config.output_dir, "checkpoints/last/pretrained_model")
                cmd.append(f"--policy.checkpoint_path={checkpoint_path}")

            # Set environment variables
            env = os.environ.copy()
            if token:
                env["HF_TOKEN"] = token

            print(f"Starting training with command: {' '.join(cmd)}")

            # Start the process
            self.current_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env,
                cwd="/mnt/data/Projects/lerobot-gui"  # Set working directory
            )

            # Start output monitoring thread
            self.output_thread = threading.Thread(target=self._monitor_output)
            self.output_thread.daemon = True
            self.output_thread.start()

            return {"message": "Training started successfully"}

        except Exception as e:
            self.is_running = False
            self.error_message = str(e)
            return {"error": f"Failed to start training: {str(e)}"}

    def stop_training(self) -> Dict:
        """Stop the current training process"""
        if not self.is_running or not self.current_process:
            return {"message": "No training process to stop"}

        try:
            # Send SIGTERM to the process
            self.current_process.terminate()
            
            # Wait a bit for graceful shutdown
            time.sleep(2)
            
            # Force kill if still running
            if self.current_process.poll() is None:
                self.current_process.kill()
                self.current_process.wait()

            self.is_running = False
            self.output_buffer.append("Training stopped by user")
            
            return {"message": "Training stopped successfully"}

        except Exception as e:
            return {"error": f"Failed to stop training: {str(e)}"}

    def get_status(self) -> Dict:
        """Get the current training status"""
        return {
            "is_running": self.is_running,
            "is_completed": self.is_completed,
            "error": self.error_message,
            "output": self.output_buffer.copy(),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "wandb_link": self._extract_wandb_link()
        }

    def clear_output(self):
        """Clear the output buffer"""
        self.output_buffer = []

    def _extract_wandb_link(self) -> Optional[str]:
        """Extract W&B link from the output buffer"""
        for line in self.output_buffer:
            # Look for any line containing a W&B URL
            match = re.search(r'(https://wandb\.ai/[^\s]+)', line)
            if match:
                return match.group(1)
        return None

    def _monitor_output(self):
        """Monitor the training process output"""
        if not self.current_process:
            return

        try:
            for line in iter(self.current_process.stdout.readline, ''):
                if line:
                    line = line.rstrip()
                    self.output_buffer.append(line)
                    print(f"Training output: {line}")

            # Process has finished
            return_code = self.current_process.wait()
            
            if return_code == 0:
                self.is_completed = True
                self.output_buffer.append("Training completed successfully!")
            else:
                self.error_message = f"Training failed with return code {return_code}"

        except Exception as e:
            self.error_message = f"Error monitoring training output: {str(e)}"
        finally:
            self.is_running = False
            self.current_process = None

# Global instance
training_service = ModelTrainingService() 