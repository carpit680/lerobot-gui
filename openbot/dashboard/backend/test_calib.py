#!/usr/bin/env python3
import subprocess
import time
import sys
import os

def test_calibration():
    print("Testing calibration process...")
    
    # Test the exact command that the backend uses
    command = [
        "/home/rightbot/miniconda3/envs/openbot-gui/bin/python", "-m", "lerobot.calibrate",
        "--robot.type=so100_follower",
        "--robot.port=/dev/ttyACM0",
        "--robot.id=test"
    ]
    
    print(f"Running command: {' '.join(command)}")
    
    try:
        # Start the process
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE,
            text=True,
            bufsize=0,
            universal_newlines=True,
            env=dict(os.environ, PYTHONUNBUFFERED="1")
        )
        
        print(f"Process started with PID: {process.pid}")
        
        # Monitor for 10 seconds
        start_time = time.time()
        while time.time() - start_time < 10:
            if process.poll() is not None:
                print(f"Process finished with exit code: {process.poll()}")
                break
                
            # Try to read output
            try:
                import select
                ready, _, _ = select.select([process.stdout], [], [], 0.1)
                if ready:
                    line = process.stdout.readline()
                    if line:
                        print(f"Output: {line.strip()}")
                    else:
                        print("No output available")
                else:
                    print("No output ready")
            except Exception as e:
                print(f"Error reading output: {e}")
                
            time.sleep(0.5)
        
        # Kill the process if it's still running
        if process.poll() is None:
            print("Killing process...")
            process.terminate()
            process.wait(timeout=5)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_calibration()