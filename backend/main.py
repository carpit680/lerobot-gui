from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import asyncio
import logging
from backend import teleoperation_service
from backend.motor_setup_service import MotorSetupService
import cv2
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi import Response
import time
import subprocess
import sys
import os

from backend.calibration_service import calibration_service as calibration_service_instance

motor_setup_service = MotorSetupService()

# Global camera stream tracking
active_camera_streams = {}

# Configure logging to suppress access logs for health checks
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI(title="LeRobot Calibration API", version="1.0.0")

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:3000", "http://127.0.0.1:3000"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CalibrationRequest(BaseModel):
    arm_type: str  # 'leader' or 'follower'
    robot_type: str  # 'so100_leader' or 'so100_follower'
    port: str
    robot_id: str

class InputRequest(BaseModel):
    session_id: str
    input_data: str = "\n"

class TeleoperationRequest(BaseModel):
    leader_type: str
    leader_port: str
    leader_id: str
    follower_type: str
    follower_port: str
    follower_id: str
    cameras: Optional[list] = None

class MotorSetupRequest(BaseModel):
    robot_type: str
    port: str

class MotorSetupInputRequest(BaseModel):
    session_id: str
    input_data: str

@app.get("/")
async def root():
    return {"message": "LeRobot Calibration API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/calibrate/start")
async def start_calibration(request: CalibrationRequest):
    """
    Start a calibration process and return a session ID
    """
    try:
        session_id = await calibration_service_instance.start_calibration(
            arm_type=request.arm_type,
            robot_type=request.robot_type,
            port=request.port,
            robot_id=request.robot_id
        )
        
        return {
            "success": True,
            "session_id": session_id,
            "message": f"Calibration started for {request.robot_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start calibration: {str(e)}")

@app.post("/calibrate/input")
async def send_input(request: InputRequest):
    """
    Send input to an active calibration process
    """
    try:
        success = await calibration_service_instance.send_input(
            session_id=request.session_id,
            input_data=request.input_data
        )
        
        return {
            "success": success,
            "message": "Input sent successfully" if success else "Failed to send input"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send input: {str(e)}")

@app.get("/calibrate/status/{session_id}")
async def get_calibration_status(session_id: str):
    """
    Get the status of a calibration process
    """
    try:
        is_running = await calibration_service_instance.is_running(session_id)
        is_waiting_for_input = await calibration_service_instance.is_waiting_for_input(session_id)
        
        return {
            "session_id": session_id,
            "is_running": is_running,
            "is_waiting_for_input": is_waiting_for_input,
            "status": "running" if is_running else "finished"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

@app.delete("/calibrate/stop/{session_id}")
async def stop_calibration(session_id: str):
    """
    Stop a calibration process
    """
    try:
        success = await calibration_service_instance.stop_calibration(session_id)
        
        return {
            "success": success,
            "message": "Calibration stopped successfully" if success else "Failed to stop calibration"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop calibration: {str(e)}")

@app.get("/check-calibration-files/{robot_id}")
async def check_calibration_files(robot_id: str, arm_type: str = "follower"):
    """
    Check if calibration files exist for a given robot ID and arm type
    """
    try:
        result = await calibration_service_instance.check_calibration_files(robot_id, arm_type)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check calibration files: {str(e)}")

@app.get("/list-ports")
async def list_ports():
    """
    List available USB ports
    """
    try:
        result = await calibration_service_instance.list_ports()
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list ports: {str(e)}")

@app.get("/detect-ports")
async def detect_ports():
    """
    Detect and return available USB ports (on-demand detection).
    """
    try:
        result = await calibration_service_instance.list_ports()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect ports: {str(e)}")

@app.get("/scan-cameras")
async def scan_cameras():
    """
    Scan for available camera devices (USB or built-in) using OpenCV.
    Returns a list of camera indices and suggested names.
    """
    cameras = []
    for idx in range(10):  # Scan indices 0-9
        cap = cv2.VideoCapture(idx)
        if cap is not None and cap.isOpened():
            # Get camera properties
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            cameras.append({
                "id": f"camera{idx}",
                "name": f"Camera {idx}",
                "index": idx,
                "url": f"/video/camera/{idx}",  # This is a placeholder; frontend can use index
                "width": width,
                "height": height,
                "fps": fps if fps > 0 else 30,
            })
            cap.release()
    return {"cameras": cameras}

def mjpeg_stream_generator(index):
    cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        print(f"Failed to open camera {index}")
        return
    
    # Get camera's native resolution
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Started MJPEG stream for camera {index} at {width}x{height}")
    
    # Store the capture object globally
    active_camera_streams[index] = cap
    
    try:
        while index in active_camera_streams:  # Check if stream is still active
            ret, frame = cap.read()
            if not ret:
                print(f"Failed to read frame from camera {index}")
                continue
            
            # Use native camera resolution
            frame = cv2.resize(frame, (width, height))
            
            ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ret:
                print(f"Failed to encode frame from camera {index}")
                continue
            
            frame_bytes = jpeg.tobytes()
            
            # Simpler MJPEG format that browsers handle better
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            # Small delay to control frame rate
            time.sleep(0.033)  # ~30 FPS
            
    except GeneratorExit:
        print(f"Client disconnected from camera {index} stream")
    except Exception as e:
        print(f"Error in MJPEG stream for camera {index}: {e}")
    finally:
        if index in active_camera_streams:
            del active_camera_streams[index]
        cap.release()
        print(f"Stopped MJPEG stream for camera {index}")

@app.get("/video/camera/{index}")
async def video_camera(index: int, response: Response):
    """
    MJPEG video stream from the specified camera index.
    """
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "close"
    
    return StreamingResponse(
        mjpeg_stream_generator(index), 
        media_type='multipart/x-mixed-replace; boundary=frame'
    )

# WebSocket endpoint for real-time output streaming
@app.websocket("/ws/calibration/{session_id}")
async def websocket_calibration(websocket: WebSocket, session_id: str):
    print(f"WebSocket connection request for session {session_id}")
    await websocket.accept()
    print(f"WebSocket connection opened for session {session_id}")
    
    message_count = 0
    
    try:
        # Send initial connection message
        initial_message = {
            "type": "status",
            "data": {"message": "WebSocket connected", "session_id": session_id}
        }
        print(f"Sending initial message: {initial_message}")
        await websocket.send_text(json.dumps(initial_message))
        print(f"Initial message sent successfully")
        message_count += 1
        
        while True:
            # Check if process is still running
            is_running = await calibration_service_instance.is_running(session_id)
            
            if not is_running:
                # Process has finished
                print(f"Process finished for {session_id}")
                try:
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "data": {"is_running": False, "status": "finished"}
                    }))
                except Exception as e:
                    print(f"Failed to send finish message for {session_id}: {e}")
                break
            
            # Get all available output messages at once
            outputs = await calibration_service_instance.get_all_output(session_id)
            if outputs:
                print(f"Retrieved {len(outputs)} outputs for {session_id}")
                for output in outputs:
                    message_count += 1
                    print(f"Sending output #{message_count} to WebSocket for {session_id}: {output}")
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "output",
                            "data": output.strip()
                        }))
                    except Exception as e:
                        print(f"Failed to send output message for {session_id}: {e}")
                        # If we can't send, the connection is likely closed
                        break
                    
                    # Check if this output indicates completion
                    if "Calibration completed successfully" in output or "Calibration saved to" in output:
                        # Double-check if process is really finished
                        is_running = await calibration_service_instance.is_running(session_id)
                        if not is_running:
                            print(f"Process confirmed finished for {session_id} after completion output")
                            try:
                                await websocket.send_text(json.dumps({
                                    "type": "status",
                                    "data": {"is_running": False, "status": "finished"}
                                }))
                            except Exception as e:
                                print(f"Failed to send completion message for {session_id}: {e}")
                            break
            
            # Wait a bit before checking again (reduced delay for more responsive output)
            await asyncio.sleep(0.01)
            
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        print(f"WebSocket error for {session_id}: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": str(e)
            }))
        except Exception as send_error:
            print(f"Failed to send error message for {session_id}: {send_error}")
    finally:
        try:
            await websocket.close()
        except Exception as close_error:
            print(f"Error closing WebSocket for {session_id}: {close_error}")
        print(f"WebSocket connection closed for session {session_id}, sent {message_count} messages total")

@app.post("/teleop/start")
async def start_teleoperation(request: TeleoperationRequest):
    try:
        session_id = await teleoperation_service.teleoperation_service.start_teleoperation(
            leader_type=request.leader_type,
            leader_port=request.leader_port,
            leader_id=request.leader_id,
            follower_type=request.follower_type,
            follower_port=request.follower_port,
            follower_id=request.follower_id,
            cameras=request.cameras
        )
        return {
            "success": True,
            "session_id": session_id,
            "message": f"Teleoperation started for leader {request.leader_id} and follower {request.follower_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start teleoperation: {str(e)}")

@app.get("/teleop/status/{session_id}")
async def get_teleoperation_status(session_id: str):
    try:
        is_running = await teleoperation_service.teleoperation_service.is_running(session_id)
        return {
            "session_id": session_id,
            "is_running": is_running,
            "status": "running" if is_running else "finished"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get teleoperation status: {str(e)}")

@app.delete("/teleop/stop/{session_id}")
async def stop_teleoperation(session_id: str):
    try:
        success = await teleoperation_service.teleoperation_service.stop_teleoperation(session_id)
        return {
            "success": success,
            "message": "Teleoperation stopped successfully" if success else "Failed to stop teleoperation"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop teleoperation: {str(e)}")

@app.websocket("/ws/teleop/{session_id}")
async def websocket_teleoperation(websocket: WebSocket, session_id: str):
    await websocket.accept()
    message_count = 0
    last_table_sent = None
    try:
        initial_message = {
            "type": "status",
            "data": {"message": "WebSocket connected", "session_id": session_id}
        }
        await websocket.send_text(json.dumps(initial_message))
        message_count += 1
        while True:
            is_running = await teleoperation_service.teleoperation_service.is_running(session_id)
            if not is_running:
                try:
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "data": {"is_running": False, "status": "finished"}
                    }))
                except Exception:
                    pass
                break
            
            # Get regular outputs (non-table)
            outputs = await teleoperation_service.teleoperation_service.get_all_output(session_id)
            if outputs:
                for output in outputs:
                    message_count += 1
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "output",
                            "data": output.strip()
                        }))
                    except Exception:
                        break
            
            # Get latest table data
            latest_table = await teleoperation_service.teleoperation_service.get_latest_table(session_id)
            if latest_table and latest_table != last_table_sent:
                try:
                    await websocket.send_text(json.dumps({
                        "type": "table",
                        "data": latest_table
                    }))
                    last_table_sent = latest_table
                except Exception as e:
                    break
            
            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": str(e)
            }))
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@app.post("/camera/{index}/start")
async def start_camera_stream(index: int):
    """Start streaming from a specific camera"""
    if index in active_camera_streams:
        return {"success": True, "message": f"Camera {index} stream already active"}
    
    # Test if camera can be opened
    cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        return {"success": False, "message": f"Camera {index} not available"}
    cap.release()
    
    return {"success": True, "message": f"Camera {index} stream started"}

@app.delete("/camera/{index}/stop")
async def stop_camera_stream(index: int):
    """Stop streaming from a specific camera and release it"""
    if index in active_camera_streams:
        cap = active_camera_streams[index]
        cap.release()
        del active_camera_streams[index]
        print(f"Released camera {index}")
        return {"success": True, "message": f"Camera {index} stream stopped and released"}
    else:
        return {"success": False, "message": f"Camera {index} stream not active"}

@app.get("/camera/{index}/status")
async def get_camera_status(index: int):
    """Get the status of a camera stream"""
    is_active = index in active_camera_streams
    return {"camera_index": index, "is_streaming": is_active}

@app.post("/run-motor-setup")
async def run_motor_setup(request: Request):
    data = await request.json()
    robot_type = data.get("type")
    robot_port = data.get("port")
    if not robot_type or not robot_port:
        return JSONResponse(status_code=400, content={"error": "Missing type or port"})
    try:
        cmd = [
            sys.executable, "-u", "-m", "lerobot.setup_motors",
            f"--robot.type={robot_type}",
            f"--robot.port={robot_port}"
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        output = proc.stdout + ("\n" + proc.stderr if proc.stderr else "")
        return {"output": output.strip()}
    except subprocess.TimeoutExpired:
        return JSONResponse(status_code=500, content={"error": "Command timed out."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.websocket("/ws/motor-setup/{session_id}")
async def websocket_motor_setup(websocket: WebSocket, session_id: str):
    print(f"Motor setup WebSocket connection request for session {session_id}")
    print(f"Session ID type: {type(session_id)}")
    print(f"Session ID length: {len(session_id)}")
    print(f"Session ID contains forward slashes: {'/' in session_id}")
    
    # Check if session exists
    is_running = await motor_setup_service.is_running(session_id)
    print(f"Session {session_id} is running: {is_running}")
    
    if not is_running:
        print(f"Session {session_id} not found or not running, rejecting connection")
        await websocket.close(code=4004, reason="Session not found")
        return
    
    await websocket.accept()
    print(f"Motor setup WebSocket connection opened for session {session_id}")
    
    message_count = 0
    
    try:
        # Send initial connection message
        initial_message = {
            "type": "status",
            "data": {"message": "WebSocket connected", "session_id": session_id}
        }
        print(f"Sending initial message: {initial_message}")
        await websocket.send_text(json.dumps(initial_message))
        print(f"Initial message sent successfully")
        message_count += 1
        
        while True:
            # Check if process is still running
            is_running = await motor_setup_service.is_running(session_id)
            
            if not is_running:
                # Process has finished
                print(f"Motor setup process finished for {session_id}")
                try:
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "data": {"is_running": False, "status": "finished"}
                    }))
                except Exception as e:
                    print(f"Failed to send finish message for {session_id}: {e}")
                break
            
            # Get all available output messages at once
            outputs = await motor_setup_service.get_all_output(session_id)
            if outputs:
                print(f"Retrieved {len(outputs)} outputs for {session_id}")
                for output in outputs:
                    message_count += 1
                    print(f"Sending output #{message_count} to WebSocket for {session_id}: {output}")
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "output",
                            "data": output.strip()
                        }))
                    except Exception as e:
                        print(f"Failed to send output message for {session_id}: {e}")
                        # If we can't send, the connection is likely closed
                        break
            
            # Wait a bit before checking again (reduced delay for more responsive output)
            await asyncio.sleep(0.01)
            
    except WebSocketDisconnect:
        print(f"Motor setup WebSocket disconnected for session {session_id}")
    except Exception as e:
        print(f"Motor setup WebSocket error for {session_id}: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": str(e)
            }))
        except Exception as send_error:
            print(f"Failed to send error message for {session_id}: {send_error}")
    finally:
        try:
            await websocket.close()
        except Exception as close_error:
            print(f"Error closing motor setup WebSocket for {session_id}: {close_error}")
        print(f"Motor setup WebSocket connection closed for session {session_id}, sent {message_count} messages total")

@app.post("/motor-setup/start")
async def start_motor_setup(request: MotorSetupRequest):
    try:
        session_id = await motor_setup_service.start_motor_setup(
            robot_type=request.robot_type,
            port=request.port
        )
        return {
            "success": True,
            "session_id": session_id,
            "message": f"Motor setup started for {request.robot_type}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start motor setup: {str(e)}")

@app.get("/motor-setup/status/{session_id}")
async def get_motor_setup_status(session_id: str):
    try:
        is_running = await motor_setup_service.is_running(session_id)
        is_waiting_for_input = await motor_setup_service.is_waiting_for_input(session_id)
        return {
            "session_id": session_id,
            "is_running": is_running,
            "is_waiting_for_input": is_waiting_for_input,
            "status": "running" if is_running else "finished"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

@app.post("/motor-setup/input")
async def send_motor_setup_input(request: MotorSetupInputRequest):
    try:
        success = await motor_setup_service.send_input(request.session_id, request.input_data)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send input: {str(e)}")

@app.delete("/motor-setup/stop/{session_id}")
async def stop_motor_setup(session_id: str):
    """
    Stop a motor setup process
    """
    try:
        success = motor_setup_service.stop_session(session_id)
        return {"success": success, "message": "Motor setup stopped" if success else "Failed to stop motor setup"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop motor setup: {str(e)}")

@app.get("/env/huggingface")
async def get_huggingface_env():
    """
    Get Hugging Face environment variables from the system
    """
    try:
        hf_user = os.environ.get('HF_USER', '')
        hf_token = os.environ.get('HUGGINGFACE_TOKEN', '')
        
        return {
            "hf_user": hf_user,
            "hf_token": hf_token,
            "has_user": bool(hf_user),
            "has_token": bool(hf_token)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get environment variables: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)