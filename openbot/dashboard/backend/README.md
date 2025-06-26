# LeRobot Calibration Backend

This is a Python FastAPI backend that provides a REST API and WebSocket interface for executing LeRobot calibration commands.

## Features

- Execute LeRobot calibration commands with real-time output streaming
- Interactive command input (simulating Enter key presses)
- Check for calibration files in the cache directory
- List available USB ports
- WebSocket support for real-time communication

## Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install LeRobot:**
   ```bash
   pip install lerobot
   ```

3. **Run the backend:**
   ```bash
   python main.py
   ```

The backend will start on `http://localhost:8000`

## API Endpoints

### REST API

- `GET /` - Health check
- `GET /health` - Health check
- `POST /calibrate/start` - Start a calibration process
- `POST /calibrate/input` - Send input to an active calibration process
- `GET /calibrate/status/{session_id}` - Get calibration status
- `DELETE /calibrate/stop/{session_id}` - Stop a calibration process
- `GET /check-calibration-files/{robot_id}` - Check for calibration files
- `GET /list-ports` - List available USB ports

### WebSocket

- `WS /ws/calibration/{session_id}` - Real-time output streaming

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

## Error Handling

The backend includes comprehensive error handling and logging. Check the console output for detailed error messages.

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