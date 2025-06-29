import { create } from 'zustand'
import { ReactNode } from 'react'

export interface ArmConfig {
  leaderPort: string
  followerPort: string
  leaderConnected: boolean
  followerConnected: boolean
  leaderRobotType: string
  followerRobotType: string
  leaderRobotId: string
  followerRobotId: string
}

export interface CameraConfig {
  id: string
  name: string
  url: string
  enabled: boolean
  width?: number
  height?: number
  fps?: number
  index?: number
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
  // Configuration
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

  // Hugging Face Credentials
  hfUser: string
  setHfUser: (user: string) => void
  hfToken: string
  setHfToken: (token: string) => void
}

export const useLeRobotStore = create<LeRobotState>((set) => ({
  // Configuration
  armConfig: {
    leaderPort: '/dev/ttyUSB0',
    followerPort: '/dev/ttyUSB1',
    leaderConnected: false,
    followerConnected: false,
    leaderRobotType: '',
    followerRobotType: '',
    leaderRobotId: '',
    followerRobotId: '',
  },
  setArmConfig: (config) => set((state) => ({
    armConfig: { ...state.armConfig, ...config }
  })),
  
  // Cameras
  cameras: [],
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

  // Hugging Face Credentials
  hfUser: import.meta.env.VITE_HF_USER || '',
  setHfUser: (user) => set({ hfUser: user }),
  hfToken: import.meta.env.VITE_HUGGINGFACE_TOKEN || '',
  setHfToken: (token) => set({ hfToken: token }),
}))

interface LeRobotStoreProps {
  children: ReactNode
}

export const LeRobotStore: React.FC<LeRobotStoreProps> = ({ children }) => {
  return <>{children}</>
} 