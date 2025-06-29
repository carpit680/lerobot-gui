# LeRobot GUI

A comprehensive web-based interface for the Hugging Face LeRobot framework, providing an intuitive interface for robot arm control, dataset management, and model training. This application consists of a React frontend and a FastAPI backend that integrates with the LeRobot library for robotic arm operations.

## 🚀 Features

### ⚙️ **Configuration Management**
- **Robot Arm Setup**: Configure leader and follower arm ports with real-time USB port detection
- **Robot Type Selection**: Support for SO-100 and Giraffe v1.1 robot types
- **Robot ID Assignment**: Set unique identifiers for each arm
- **Hugging Face Integration**: Manage Hugging Face credentials for dataset operations
- **Camera Configuration**: Multi-camera setup with real-time streaming capabilities
- **Motor Setup**: Interactive motor configuration and calibration tools

### 🔧 **Calibration System**
- Step-by-step calibration process for both leader and follower arms
- Real-time progress tracking via WebSocket connections
- Interactive command input for calibration procedures
- Comprehensive calibration validation and file management

### 🎮 **Teleoperation**
- Manual control of robot arms with multiple control modes
- Real-time camera feeds for visual feedback
- Keyboard controls for precise movement
- Adjustable speed and sensitivity settings
- Support for both joint and cartesian control modes

### 📹 **Dataset Management**
- **Recording**: Multi-camera dataset recording with configurable parameters
- **Visualization**: Interactive charts and analytics for dataset analysis
- **Replay**: Video player with playback controls and frame-by-frame seeking
- **Export**: Dataset export capabilities and Hugging Face Hub integration

### 🧠 **Model Training**
- Multiple model architectures (Transformer, LSTM, CNN, MLP)
- Configurable training parameters (learning rate, batch size, epochs)
- Real-time training progress visualization
- Integration with Weights & Biases for experiment tracking
- Dataset selection and validation

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router DOM** for navigation
- **Recharts** for data visualization
- **Heroicons** for UI icons
- **Vite** for build tooling

### Backend
- **FastAPI** for REST API and WebSocket support
- **Python 3.10+** with Poetry dependency management
- **LeRobot** framework integration
- **OpenCV** for camera operations
- **Pydantic** for data validation

## 📋 Prerequisites

Before installing LeRobot GUI, ensure you have the following:

- **Node.js 16+** and npm/yarn
- **Python 3.10+** and Poetry
- **USB ports** for robot arm connections
- **Camera devices** (optional, for visual feedback)
- **Hugging Face account** (optional, for dataset operations)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/carpit680/lerobot-gui
cd lerobot-gui
```

### 2. Frontend Setup

```bash
# Install Node.js dependencies
npm install
```

**Environment Variables:**
```bash
# .bashrc or .zshrc
HF_USER=your_huggingface_username
HUGGINGFACE_TOKEN=your_huggingface_token
```

### 3. Backend Setup

```bash
# Install Python dependencies using Poetry
poetry install

# Activate the virtual environment
poetry shell
```

## 🏃‍♂️ Running the Application

### Development Mode

1. **Start the Backend Server:**
   ```bash
   # In the root directory with Poetry
   poetry run python -m backend.main
   ```
   
   The backend will start on `http://localhost:8000`

2. **Start the Frontend Development Server:**
   ```bash
   # In the root directory
   npm run dev
   ```
   
   The frontend will start on `http://localhost:3000`

3. **Access the Application:**
   Open your browser and navigate to `http://localhost:3000`

## 📖 Usage Guide

### 1. Initial Configuration

1. **Navigate to Configuration Page**
   - The application will automatically redirect to the configuration page
   - This is where you set up your robot arms and system settings

2. **Hugging Face Setup (Optional)**
   - Enter your Hugging Face username and access token
   - These credentials are used for dataset operations and model training
   - Credentials can be loaded from environment variables automatically

3. **Robot Arm Configuration**
   - **Scan USB Ports**: Click "Scan USB Ports" to detect connected devices
   - **Select Ports**: Choose appropriate ports for leader and follower arms
   - **Robot Types**: Select robot type (SO-100 or Giraffe v1.1) for each arm
   - **Robot IDs**: Assign unique identifiers (e.g., "leader_001", "follower_001")

4. **Camera Setup**
   - **Scan Cameras**: Click "Scan Cameras" to detect available camera devices
   - **Test Streaming**: Start camera streams to verify functionality

5. **Motor Configuration**
   - Select the arm to configure (leader or follower)
   - Run motor setup for the selected arm
   - Follow interactive prompts to complete motor configuration

### 2. Calibration Process

1. **Navigate to Calibration Page**
   - Ensure both arms are properly connected
   - Verify port configurations are correct

2. **Start Calibration**
   - Select the arm to calibrate (leader or follower)
   - Click "Start Calibration" to begin the process
   - Monitor real-time output in the console

3. **Interactive Calibration**
   - Follow the step-by-step instructions
   - Click "Continue" when prompted for user input
   - Monitor progress and address any issues

4. **Verification**
   - Check calibration files are saved
   - Verify both arms are properly calibrated

### 3. Teleoperation

1. **Navigate to Teleoperation Page**
   - Select camera feeds for visual feedback
   - Choose control mode (joint or cartesian)

2. **Control Options**
   - **On-screen Controls**: Use the interface buttons for movement
   - **Keyboard Controls**: Use arrow keys and WASD for precise control
   - **Speed Adjustment**: Modify movement speed and sensitivity

3. **Safety Features**
   - Emergency stop functionality
   - Position limits and safety checks
   - Real-time position monitoring

### 4. Dataset Operations

#### Recording Datasets
1. **Navigate to Dataset Recording**
   - Configure recording session with descriptive name
   - Select cameras for recording
   - Set recording parameters (episodes, duration, etc.)

2. **Start Recording**
   - Click "Start Recording" to begin
   - Monitor recording progress and statistics
   - Pause/resume as needed

3. **Complete Recording**
   - Stop recording when complete
   - Review recorded data and statistics

#### Visualizing Datasets
1. **Navigate to Dataset Visualization**
   - Select dataset from available list
   - Choose visualization mode (overview, trajectory, joints, timeline)
   - Analyze charts and statistics

2. **Export Options**
   - Export data in various formats
   - Share datasets via Hugging Face Hub

#### Replaying Datasets
1. **Navigate to Dataset Replay**
   - Select dataset to replay
   - Use video player controls
   - Adjust playback speed and seek through frames

### 5. Model Training

1. **Navigate to Model Training**
   - Configure model parameters (type, learning rate, batch size, epochs)
   - Select training datasets
   - Set output paths and logging options

2. **Start Training**
   - Click "Start Training" to begin
   - Monitor real-time progress and metrics
   - View loss and accuracy charts

3. **Training Management**
   - Stop training if needed
   - View Weights & Biases integration
   - Save trained models

## 🔧 Configuration

### Robot Types

Supported robot configurations:
- **SO-100 Leader**: `so100_leader`
- **SO-100 Follower**: `so100_follower`
- **Giraffe v1.1 Leader**: `giraffe_leader`
- **Giraffe v1.1 Follower**: `giraffe_follower`

## 🧪 Testing

### Frontend Tests
```bash
npm test
```

### Backend Tests
```bash
# Using Poetry
poetry run pytest backend/tests
```

## 📁 Project Structure

```
lerobot-gui/
├── backend/                    # FastAPI backend
│   ├── main.py                # Main application entry point
│   ├── calibration_service.py # Calibration service
│   ├── dataset_*.py          # Dataset management services
│   ├── teleoperation_service.py # Teleoperation service
│   ├── model_training_service.py # Model training service
│   └── tests/                # Backend tests
├── src/                      # React frontend
│   ├── components/           # Reusable UI components
│   ├── pages/               # Page components
│   │   ├── ArmConfiguration.tsx
│   │   ├── Calibration.tsx
│   │   ├── Teleoperation.tsx
│   │   ├── DatasetRecording.tsx
│   │   ├── DatasetVisualization.tsx
│   │   ├── DatasetReplay.tsx
│   │   └── ModelTraining.tsx
│   ├── store/               # Zustand state management
│   └── App.tsx              # Main app component
├── public/                  # Static assets
├── package.json             # Frontend dependencies
├── pyproject.toml          # Backend dependencies
└── README.md               # This file
```

## 🔌 API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `GET /list-ports` - List available USB ports
- `GET /scan-cameras` - Scan for available cameras

### Calibration
- `POST /calibrate/start` - Start calibration process
- `POST /calibrate/input` - Send input to calibration
- `GET /calibrate/status/{session_id}` - Get calibration status
- `DELETE /calibrate/stop/{session_id}` - Stop calibration

### Teleoperation
- `POST /teleop/start` - Start teleoperation
- `GET /teleop/status/{session_id}` - Get teleoperation status
- `DELETE /teleop/stop/{session_id}` - Stop teleoperation

### Dataset Operations
- `POST /dataset-recording/start` - Start dataset recording
- `POST /dataset-replay/start` - Start dataset replay
- `POST /dataset-visualization/fetch` - Fetch user datasets

### Model Training
- `POST /model-training/start` - Start model training
- `GET /model-training/status` - Get training status
- `POST /model-training/stop` - Stop training

### WebSocket Endpoints
- `WS /ws/calibration/{session_id}` - Real-time calibration output
- `WS /ws/teleop/{session_id}` - Real-time teleoperation data
- `WS /ws/dataset-recording/{session_id}` - Real-time recording status

## 🐛 Troubleshooting

### Common Issues

1. **Backend Connection Failed**
   - Ensure the backend server is running on port 8000
   - Check firewall settings
   - Verify CORS configuration

2. **USB Port Not Detected**
   - Check device permissions (may need sudo on Linux)
   - Verify USB drivers are installed
   - Try different USB ports

3. **Camera Not Working**
   - Check camera permissions
   - Verify camera is not in use by another application
   - Test camera with other applications

4. **LeRobot Import Errors**
   - Ensure LeRobot is properly installed
   - Check Python environment and dependencies
   - Verify the correct LeRobot fork is installed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 🙏 Acknowledgments

- Hugging Face LeRobot team for the base framework
- OpenBot team for the GUI integration
- React and FastAPI communities for excellent tooling

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Check API Docs here: `http://localhost:8000/docs`
- Open an issue on the repository 