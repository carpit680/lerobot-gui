# LeRobot Dashboard

A comprehensive web-based dashboard for the Hugging Face LeRobot framework, providing an intuitive interface for robot arm control, dataset management, and model training.

## Features

### 🤖 Arm Configuration
- Configure leader and follower arm ports
- Set robot types (SO-100, Giraffe v1.1) for both arms
- Configure unique robot IDs for both arms
- Real-time connection status monitoring
- Port selection with common defaults
- Connection testing and validation
- **Hugging Face Credentials Management**
  - Set Hugging Face username and access token
  - Automatic loading from system environment variables (`HF_USER` and `HUGGINGFACE_TOKEN`)
  - Secure token storage in application state
  - Visual indicators when credentials are loaded from environment

### 🔧 Calibration
- Step-by-step calibration process for both arms
- Uses robot configuration from Arm Configuration page
- Real-time progress tracking
- Comprehensive calibration validation
- Troubleshooting guidance

### 🎮 Teleoperation
- Manual control of robot arms
- Uses robot configuration from Arm Configuration page
- Multiple control modes (joint and cartesian)
- Real-time camera feeds
- Keyboard controls for precise movement
- Speed and sensitivity adjustments

### 📹 Dataset Recording
- Multi-camera dataset recording
- Real-time recording status
- Session management and naming
- Frame counting and size monitoring
- Pause/resume functionality

### 📊 Dataset Visualization
- Interactive charts and graphs
- Multiple visualization modes (overview, trajectory, joints, timeline)
- Dataset statistics and analytics
- Export capabilities
- Dataset management (view, delete)

### ▶️ Dataset Replay
- Video player with playback controls
- Adjustable playback speed
- Frame-by-frame seeking
- Loop functionality
- Real-time progress tracking

### 🧠 Model Training
- Multiple model types (Transformer, LSTM, CNN, MLP)
- Configurable training parameters
- Real-time training progress visualization
- Loss and accuracy charts
- Dataset selection for training

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **Icons**: Heroicons
- **Build Tool**: Vite
- **Routing**: React Router DOM

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lerobot-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Sidebar.tsx     # Navigation sidebar
├── pages/              # Page components
│   ├── Dashboard.tsx           # Main dashboard
│   ├── ArmConfiguration.tsx    # Arm setup and configuration
│   ├── Calibration.tsx         # Arm calibration
│   ├── Teleoperation.tsx       # Manual arm control
│   ├── DatasetRecording.tsx    # Dataset recording interface
│   ├── DatasetVisualization.tsx # Dataset analysis
│   ├── DatasetReplay.tsx       # Dataset replay
│   └── ModelTraining.tsx       # Model training interface
├── store/              # State management
│   └── lerobotStore.tsx # Zustand store
├── App.tsx             # Main app component
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## Usage

### 1. Arm Configuration
- Navigate to "Arm Configuration"
- **Hugging Face Credentials** (optional):
  - Credentials are automatically loaded from system environment variables if available
  - Manually enter your Hugging Face username and access token if needed
  - These credentials are used for Hugging Face API access across the application
- **Robot Configuration**:
  - Select appropriate ports for leader and follower arms
  - Choose robot types (SO-100 or Giraffe v1.1) for both arms
  - Set unique robot IDs for both arms
  - Test connections
  - Verify both arms are connected before proceeding

### 2. Calibration
- Ensure both arms are configured in Arm Configuration
- Select which arm to calibrate (leader or follower)
- Follow the step-by-step calibration process
- Monitor progress and address any issues
- Complete all calibration steps

### 3. Teleoperation
- Ensure both arms are configured in Arm Configuration
- Select camera feed for visual feedback
- Choose control mode (joint or cartesian)
- Use on-screen controls or keyboard for movement
- Adjust speed and sensitivity as needed

### 4. Dataset Recording
- Configure recording session with descriptive name
- Select cameras for recording
- Start recording and monitor progress
- Pause/resume as needed
- Stop recording when complete

### 5. Dataset Visualization
- Select dataset from the list
- Choose visualization mode
- Analyze charts and statistics
- Export data if needed

### 6. Dataset Replay
- Select dataset to replay
- Use video player controls
- Adjust playback speed
- Monitor replay progress

### 7. Model Training
- Configure model parameters
- Select training datasets
- Start training and monitor progress
- View real-time charts
- Save trained models

## Configuration

### Camera Setup
The dashboard supports multiple camera feeds. Configure cameras in the store:

```typescript
cameras: [
  { id: 'camera1', name: 'Front Camera', url: 'http://localhost:8080/stream.mjpg', enabled: true },
  { id: 'camera2', name: 'Side Camera', url: 'http://localhost:8081/stream.mjpg', enabled: false },
  // Add more cameras as needed
]
```

### Port Configuration
Default ports can be modified in the store:

```typescript
armConfig: {
  leaderPort: '/dev/ttyUSB0',
  followerPort: '/dev/ttyUSB1',
  // ...
}
```

### Environment Variables
The dashboard can automatically load Hugging Face credentials from system environment variables:

```bash
# Set in your shell profile (.bashrc, .zshrc, etc.)
export HF_USER="your_huggingface_username"
export HUGGINGFACE_TOKEN="your_huggingface_access_token"
```

These credentials will be automatically loaded when you visit the Arm Configuration page and can be manually overridden if needed.

**Note:** The backend reads these environment variables and provides them to the frontend securely. The frontend stores them in application state for use across all pages.

## Development

### Adding New Features
1. Create new components in `src/components/`
2. Add new pages in `src/pages/`
3. Update the store in `src/store/lerobotStore.tsx`
4. Add routing in `src/App.tsx`

### Styling
The project uses Tailwind CSS with custom components defined in `src/index.css`.

### State Management
All application state is managed through Zustand in `src/store/lerobotStore.tsx`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting sections in each page
- Review the console for error messages
- Ensure all prerequisites are met
- Verify hardware connections

## Roadmap

- [ ] Real-time 3D visualization
- [ ] Advanced model architectures
- [ ] Cloud integration
- [ ] Multi-user support
- [ ] API documentation
- [ ] Plugin system
- [ ] Mobile app
- [ ] Offline mode 