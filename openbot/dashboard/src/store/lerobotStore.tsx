import { create } from 'zustand'
import { ReactNode } from 'react'

export interface ArmConfig {
  leaderPort: string
  followerPort: string
  leaderConnected: boolean
  followerConnected: boolean
}

export interface CameraConfig {
  id: string
  name: string
  url: string
  enabled: boolean
}

export interface Dataset {
  id: string
  name: string
  path: string
  size: number
  createdAt: string
  duration: number
  frameCount: number
}

export interface TrainingConfig {
  modelType: string
  learningRate: number
  batchSize: number
  epochs: number
  datasetPath: string
  outputPath: string
}

export interface LeRobotState {
  // Arm Configuration
  armConfig: ArmConfig
  setArmConfig: (config: Partial<ArmConfig>) => void
  
  // Cameras
  cameras: CameraConfig[]
  setCameras: (cameras: CameraConfig[]) => void
  toggleCamera: (id: string) => void
  
  // Datasets
  datasets: Dataset[]
  setDatasets: (datasets: Dataset[]) => void
  addDataset: (dataset: Dataset) => void
  removeDataset: (id: string) => void
  
  // Training
  trainingConfig: TrainingConfig
  setTrainingConfig: (config: Partial<TrainingConfig>) => void
  isTraining: boolean
  setTraining: (training: boolean) => void
  
  // Connection Status
  isConnected: boolean
  setConnected: (connected: boolean) => void
  
  // Current Session
  currentSession: {
    isRecording: boolean
    isReplaying: boolean
    isTeleoperating: boolean
  }
  setSessionState: (state: Partial<LeRobotState['currentSession']>) => void
}

export const useLeRobotStore = create<LeRobotState>((set) => ({
  // Arm Configuration
  armConfig: {
    leaderPort: '/dev/ttyUSB0',
    followerPort: '/dev/ttyUSB1',
    leaderConnected: false,
    followerConnected: false,
  },
  setArmConfig: (config) => set((state) => ({
    armConfig: { ...state.armConfig, ...config }
  })),
  
  // Cameras
  cameras: [
    { id: 'camera1', name: 'Front Camera', url: 'http://localhost:8080/stream.mjpg', enabled: true },
    { id: 'camera2', name: 'Side Camera', url: 'http://localhost:8081/stream.mjpg', enabled: false },
    { id: 'camera3', name: 'Top Camera', url: 'http://localhost:8082/stream.mjpg', enabled: false },
  ],
  setCameras: (cameras) => set({ cameras }),
  toggleCamera: (id) => set((state) => ({
    cameras: state.cameras.map(camera => 
      camera.id === id ? { ...camera, enabled: !camera.enabled } : camera
    )
  })),
  
  // Datasets
  datasets: [],
  setDatasets: (datasets) => set({ datasets }),
  addDataset: (dataset) => set((state) => ({
    datasets: [...state.datasets, dataset]
  })),
  removeDataset: (id) => set((state) => ({
    datasets: state.datasets.filter(dataset => dataset.id !== id)
  })),
  
  // Training
  trainingConfig: {
    modelType: 'transformer',
    learningRate: 0.001,
    batchSize: 32,
    epochs: 100,
    datasetPath: '',
    outputPath: './models',
  },
  setTrainingConfig: (config) => set((state) => ({
    trainingConfig: { ...state.trainingConfig, ...config }
  })),
  isTraining: false,
  setTraining: (training) => set({ isTraining: training }),
  
  // Connection Status
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
  
  // Current Session
  currentSession: {
    isRecording: false,
    isReplaying: false,
    isTeleoperating: false,
  },
  setSessionState: (state) => set((currentState) => ({
    currentSession: { ...currentState.currentSession, ...state }
  })),
}))

interface LeRobotStoreProps {
  children: ReactNode
}

export const LeRobotStore: React.FC<LeRobotStoreProps> = ({ children }) => {
  return <>{children}</>
} 