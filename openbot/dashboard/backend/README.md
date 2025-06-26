# LeRobot Backend API

A FastAPI-based backend service for the LeRobot Dashboard, providing robot arm control, calibration, teleoperation, and configuration management.

## Features

### 🤖 Arm Configuration Service
- **Centralized Robot Configuration**: Store and manage robot type, port, and ID settings
- **Configuration Persistence**: Save configuration to JSON file for persistence across sessions
- **Connection Testing**: Test serial connections to robot arms
- **Configuration Validation**: Validate configuration for errors and warnings
- **Port Detection**: Automatically detect available USB ports

### 🔧 Calibration Service
- **Step-by-step Calibration**: Guided calibration process for robot arms
- **Real-time Progress**: WebSocket-based real-time progress updates
- **User Input Handling**: Interactive calibration steps requiring user input
- **Session Management**: Track calibration sessions with unique IDs

### 🎮 Teleoperation Service
- **Manual Control**: Direct control of robot arms
- **Real-time Feedback**: WebSocket-based joint position updates
- **Camera Integration**: Support for multiple camera feeds
- **Session Management**: Track teleoperation sessions

### 🔧 Motor Setup Service
- **Motor Configuration**: Setup and configure robot motors
- **Interactive Setup**: Step-by-step motor configuration process
- **Real-time Feedback**: Live updates during setup process

## API Endpoints

### Arm Configuration

#### GET `/arm-config`
Get the complete arm configuration for both leader and follower arms.

**Response:**
```json
{
  "success": true,
  "config": {
    "leader": {
      "port": "/dev/ttyUSB0",
      "robot_type": "so100",
      "robot_id": "leader_arm",
      "connected": true
    },
    "follower": {
      "port": "/dev/ttyUSB1",
      "robot_type": "giraffe",
      "robot_id": "follower_arm",
      "connected": false
    }
  }
}
```

#### GET `/arm-config/leader`
Get leader arm configuration only.

#### GET `/arm-config/follower`
Get follower arm configuration only.

#### PUT `/arm-config/leader`
Update leader arm configuration.

**Request Body:**
```json
{
  "port": "/dev/ttyUSB0",
  "robot_type": "so100",
  "robot_id": "leader_arm"
}
```

#### PUT `/arm-config/follower`
Update follower arm configuration.

**Request Body:**
```json
{
  "port": "/dev/ttyUSB1",
  "robot_type": "giraffe",
  "robot_id": "follower_arm"
}
```

#### POST `/arm-config/test-connection`
Test connection to a specific arm.

**Request Body:**
```json
{
  "arm_type": "leader"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Leader arm connected successfully",
  "port": "/dev/ttyUSB0",
  "robot_type": "so100",
  "robot_id": "leader_arm",
  "connected": true
}
```

#### GET `/arm-config/validate`
Validate current arm configuration.

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "config": { ... }
}
```

#### DELETE `/arm-config/reset`
Reset arm configuration to defaults.

#### GET `/arm-config/ports`
Get available USB ports.

**Response:**
```json
{
  "success": true,
  "ports": [
    {
      "path": "/dev/ttyUSB0",
      "name": "USB Serial Device",
      "manufacturer": "FTDI",
      "product": "USB Serial"
    }
  ]
}
```

### Calibration

#### POST `/calibrate/start`
Start a calibration process.

**Request Body:**
```json
{
  "arm_type": "leader",
  "robot_type": "so100_leader",
  "port": "/dev/ttyUSB0",
  "robot_id": "leader_arm"
}
```

#### POST `/calibrate/input`
Send input to an active calibration process.

#### GET `/calibrate/status/{session_id}`
Get calibration status.

#### DELETE `/calibrate/stop/{session_id}`
Stop a calibration process.

#### GET `/check-calibration-files/{robot_id}`
Check if calibration files exist.

### Teleoperation

#### POST `/teleop/start`
Start teleoperation.

**Request Body:**
```json
{
  "leader_type": "so100_leader",
  "leader_port": "/dev/ttyUSB0",
  "leader_id": "leader_arm",
  "follower_type": "giraffe_follower",
  "follower_port": "/dev/ttyUSB1",
  "follower_id": "follower_arm",
  "cameras": [...]
}
```

#### GET `/teleop/status/{session_id}`
Get teleoperation status.

#### DELETE `/teleop/stop/{session_id}`
Stop teleoperation.

### Motor Setup

#### POST `/motor-setup/start`
Start motor setup process.

#### POST `/motor-setup/input`
Send input to motor setup process.

#### GET `/motor-setup/status/{session_id}`
Get motor setup status.

#### DELETE `/motor-setup/stop/{session_id}`
Stop motor setup process.

### Camera Management

#### GET `/scan-cameras`
Scan for available cameras.

#### GET `/video/camera/{index}`
Get camera video stream.

#### POST `/camera/{index}/start`
Start camera stream.

#### DELETE `/camera/{index}/stop`
Stop camera stream.

#### GET `/camera/{index}/status`
Get camera status.

### System

#### GET `/health`
Health check endpoint.

#### GET `/list-ports`
List available USB ports.

#### GET `/detect-ports`
Detect USB ports (alias for list-ports).

#### GET `/env/huggingface`
Get Hugging Face environment variables.

## WebSocket Endpoints

### `/ws/calibration/{session_id}`
Real-time calibration progress updates.

### `/ws/teleop/{session_id}`
Real-time teleoperation data.

### `/ws/motor-setup/{session_id}`
Real-time motor setup progress.

## Configuration

### Arm Configuration File
The arm configuration is stored in `arm_config.json` in the backend directory:

```json
{
  "leader": {
    "port": "/dev/ttyUSB0",
    "robot_type": "so100",
    "robot_id": "leader_arm",
    "connected": false
  },
  "follower": {
    "port": "/dev/ttyUSB1",
    "robot_type": "giraffe",
    "robot_id": "follower_arm",
    "connected": false
  }
}
```

### Environment Variables
- `HF_USER`: Hugging Face username
- `HUGGINGFACE_TOKEN`: Hugging Face access token

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Testing

Run the test suite:
```bash
pytest backend/tests/
```

## Development

### Adding New Features
1. Create new service files in the `backend/` directory
2. Add API endpoints in `main.py`
3. Add tests in `backend/tests/
4. Update documentation

### Service Architecture
- **Service Classes**: Business logic in separate service classes
- **API Endpoints**: FastAPI endpoints in `main.py`
- **WebSocket Support**: Real-time communication for progress updates
- **Configuration Management**: Centralized configuration storage

## Error Handling

The API uses standard HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

All endpoints return JSON responses with consistent structure:
```json
{
  "success": true/false,
  "message": "Description",
  "error": "Error details (if applicable)"
}
```

## Usage Examples

### Start Calibration
```bash
curl -X POST "http://localhost:8000/calibrate/start" \
  -H "Content-Type: application/json" \
  -d '{
    "arm_type": "follower",
    "robot_type": "so100_follower",
    "port": "/dev/tty.usbmodem58760431551",
    "robot_id": "my_awesome_follower_arm"
  }'
```

### Send Input (Continue)
```bash
curl -X POST "http://localhost:8000/calibrate/input" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "my_awesome_follower_arm_follower",
    "input_data": "\n"
  }'
```

### Check Calibration Files
```bash
curl "http://localhost:8000/check-calibration-files/my_awesome_follower_arm"
```

### List Ports
```bash
curl "http://localhost:8000/list-ports"
```

## Calibration Process

1. **Start Calibration**: Call `/calibrate/start` with arm configuration
2. **Monitor Output**: Use WebSocket or poll status endpoint
3. **Send Input**: When prompted, call `/calibrate/input` to send Enter key
4. **Check Files**: After completion, check for saved calibration files

## Calibration Files

Calibration files are automatically saved to:
```
~/.cache/huggingface/lerobot/calibration/robots/
```

## Development

To run in development mode with auto-reload:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Poetry-based Dependency Management

This backend now uses [Poetry](https://python-poetry.org/) for dependency and environment management. All dependencies are tracked in the root `pyproject.toml` and `poetry.lock` files.

### Common Commands

- **Install all dependencies:**
  ```bash
  poetry install
  ```
- **Add a dependency:**
  ```bash
  poetry add <package>
  ```
- **Add a dev (test) dependency:**
  ```bash
  poetry add --group dev <package>
  ```
- **Remove a dependency:**
  ```bash
  poetry remove <package>
  ```
- **Run tests:**
  ```bash
  poetry run pytest backend/tests
  ```
- **Spawn a shell in the Poetry environment:**
  ```bash
  poetry shell
  ```

> **Note:** The old `requirements.txt` is now legacy. Use `pyproject.toml` and `poetry.lock` as the source of truth for backend dependencies. 