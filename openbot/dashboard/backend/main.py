from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import asyncio
import logging
from calibration_service import calibration_service

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
        session_id = await calibration_service.start_calibration(
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
        success = await calibration_service.send_input(
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
        is_running = await calibration_service.is_running(session_id)
        is_waiting_for_input = await calibration_service.is_waiting_for_input(session_id)
        
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
        success = await calibration_service.stop_calibration(session_id)
        
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
        result = await calibration_service.check_calibration_files(robot_id, arm_type)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check calibration files: {str(e)}")

@app.get("/list-ports")
async def list_ports():
    """
    List available USB ports
    """
    try:
        result = await calibration_service.list_ports()
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list ports: {str(e)}")

@app.get("/detect-ports")
async def detect_ports():
    """
    Detect and return available USB ports (on-demand detection).
    """
    try:
        result = await calibration_service.list_ports()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect ports: {str(e)}")

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
            is_running = await calibration_service.is_running(session_id)
            
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
            outputs = await calibration_service.get_all_output(session_id)
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
                        is_running = await calibration_service.is_running(session_id)
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 