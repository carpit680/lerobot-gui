import { useState, useEffect } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  PlayIcon,
  StopIcon,
  PauseIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrainingMetrics {
  epoch: number
  loss: number
  accuracy: number
  validationLoss: number
  validationAccuracy: number
}

interface TrainingProgress {
  currentEpoch: number
  totalEpochs: number
  currentStep: number
  totalSteps: number
  loss: number
  accuracy: number
  learningRate: number
  eta: string
}

export default function ModelTraining() {
  const { datasets, trainingConfig, setTrainingConfig, isTraining, setTraining } = useLeRobotStore()
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([])
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null)
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics[]>([])
  const [isPaused, setIsPaused] = useState(false)

  const modelTypes = [
    { value: 'transformer', label: 'Transformer', description: 'Attention-based model for sequence learning' },
    { value: 'lstm', label: 'LSTM', description: 'Long Short-Term Memory for temporal data' },
    { value: 'cnn', label: 'CNN', description: 'Convolutional Neural Network for spatial features' },
    { value: 'mlp', label: 'MLP', description: 'Multi-Layer Perceptron for simple mappings' },
  ]

  const startTraining = () => {
    if (selectedDatasets.length === 0) {
      toast.error('Please select at least one dataset for training')
      return
    }

    if (!trainingConfig.datasetPath) {
      toast.error('Please specify a dataset path')
      return
    }

    setTraining(true)
    setIsPaused(false)
    setTrainingProgress({
      currentEpoch: 0,
      totalEpochs: trainingConfig.epochs,
      currentStep: 0,
      totalSteps: 100,
      loss: 0,
      accuracy: 0,
      learningRate: trainingConfig.learningRate,
      eta: '00:00:00'
    })
    setTrainingMetrics([])
    toast.success('Training started')
  }

  const pauseTraining = () => {
    setIsPaused(true)
    toast.success('Training paused')
  }

  const resumeTraining = () => {
    setIsPaused(false)
    toast.success('Training resumed')
  }

  const stopTraining = () => {
    setTraining(false)
    setIsPaused(false)
    setTrainingProgress(null)
    toast.success('Training stopped')
  }

  // Simulate training progress
  useEffect(() => {
    if (isTraining && !isPaused && trainingProgress) {
      const interval = setInterval(() => {
        setTrainingProgress(prev => {
          if (!prev) return prev

          const newStep = prev.currentStep + 1
          const newEpoch = Math.floor(newStep / prev.totalSteps)
          
          if (newEpoch >= prev.totalEpochs) {
            setTraining(false)
            setIsPaused(false)
            toast.success('Training completed!')
            return null
          }

          // Simulate metrics
          const progress = newStep / (prev.totalSteps * prev.totalEpochs)
          const loss = Math.max(0.1, 2 * Math.exp(-progress * 3) + Math.random() * 0.1)
          const accuracy = Math.min(0.95, 0.3 + progress * 0.6 + Math.random() * 0.05)

          // Add to metrics every epoch
          if (newStep % prev.totalSteps === 0) {
            setTrainingMetrics(prev => [...prev, {
              epoch: newEpoch,
              loss,
              accuracy,
              validationLoss: loss * (1 + Math.random() * 0.2),
              validationAccuracy: accuracy * (0.9 + Math.random() * 0.1)
            }])
          }

          return {
            ...prev,
            currentEpoch: newEpoch,
            currentStep: newStep % prev.totalSteps,
            loss,
            accuracy,
            eta: formatETA((prev.totalEpochs - newEpoch) * 30) // 30 seconds per epoch
          }
        })
      }, 100)

      return () => clearInterval(interval)
    }
  }, [isTraining, isPaused, trainingProgress])

  const toggleDataset = (datasetId: string) => {
    setSelectedDatasets(prev => 
      prev.includes(datasetId)
        ? prev.filter(id => id !== datasetId)
        : [...prev, datasetId]
    )
  }

  const formatETA = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatProgress = (current: number, total: number) => {
    return ((current / total) * 100).toFixed(1)
  }

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Model Training</h1>
            <p className="mt-2 text-gray-600">
              Train machine learning models with your recorded datasets
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Training Configuration */}
            <div className="lg:col-span-1">
              <div className="space-y-6">
                {/* Model Configuration */}
                <div className="card">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Model Configuration</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Model Type
                      </label>
                      <select
                        value={trainingConfig.modelType}
                        onChange={(e) => setTrainingConfig({ modelType: e.target.value })}
                        className="input-field"
                      >
                        {modelTypes.map(model => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {modelTypes.find(m => m.value === trainingConfig.modelType)?.description}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Learning Rate
                      </label>
                      <input
                        type="number"
                        value={trainingConfig.learningRate}
                        onChange={(e) => setTrainingConfig({ learningRate: Number(e.target.value) })}
                        step="0.0001"
                        min="0.0001"
                        max="1"
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Batch Size
                      </label>
                      <input
                        type="number"
                        value={trainingConfig.batchSize}
                        onChange={(e) => setTrainingConfig({ batchSize: Number(e.target.value) })}
                        min="1"
                        max="512"
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Epochs
                      </label>
                      <input
                        type="number"
                        value={trainingConfig.epochs}
                        onChange={(e) => setTrainingConfig({ epochs: Number(e.target.value) })}
                        min="1"
                        max="1000"
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dataset Path
                      </label>
                      <input
                        type="text"
                        value={trainingConfig.datasetPath}
                        onChange={(e) => setTrainingConfig({ datasetPath: e.target.value })}
                        placeholder="/path/to/datasets"
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Output Path
                      </label>
                      <input
                        type="text"
                        value={trainingConfig.outputPath}
                        onChange={(e) => setTrainingConfig({ outputPath: e.target.value })}
                        placeholder="./models"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* Dataset Selection */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset Selection</h3>
                  
                  <div className="space-y-3">
                    {datasets.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No datasets available</p>
                    ) : (
                      datasets.map(dataset => (
                        <label key={dataset.id} className="flex items-start">
                          <input
                            type="checkbox"
                            checked={selectedDatasets.includes(dataset.id)}
                            onChange={() => toggleDataset(dataset.id)}
                            disabled={isTraining}
                            className="mt-1 mr-3"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{dataset.name}</div>
                            <div className="text-sm text-gray-600">
                              {dataset.frameCount} frames • {Math.round(dataset.size / 1024 / 1024)} MB
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(dataset.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Training Controls */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Controls</h3>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      {!isTraining ? (
                        <button
                          onClick={startTraining}
                          disabled={selectedDatasets.length === 0}
                          className="btn-primary flex-1 disabled:opacity-50"
                        >
                          <PlayIcon className="h-4 w-4 mr-2" />
                          Start Training
                        </button>
                      ) : (
                        <>
                          {!isPaused ? (
                            <button
                              onClick={pauseTraining}
                              className="btn-secondary flex-1"
                            >
                              <PauseIcon className="h-4 w-4 mr-2" />
                              Pause
                            </button>
                          ) : (
                            <button
                              onClick={resumeTraining}
                              className="btn-primary flex-1"
                            >
                              <PlayIcon className="h-4 w-4 mr-2" />
                              Resume
                            </button>
                          )}
                          <button
                            onClick={stopTraining}
                            className="btn-danger flex-1"
                          >
                            <StopIcon className="h-4 w-4 mr-2" />
                            Stop
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Training Status */}
                {trainingProgress && (
                  <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Status</h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className={`text-sm font-medium ${
                          isTraining && !isPaused ? 'text-green-600' :
                          isPaused ? 'text-yellow-600' : 'text-gray-600'
                        }`}>
                          {isTraining && !isPaused ? 'Training' :
                           isPaused ? 'Paused' : 'Stopped'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Epoch:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {trainingProgress.currentEpoch + 1} / {trainingProgress.totalEpochs}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Progress:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatProgress(trainingProgress.currentEpoch * trainingProgress.totalSteps + trainingProgress.currentStep, 
                                        trainingProgress.totalEpochs * trainingProgress.totalSteps)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Loss:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {trainingProgress.loss.toFixed(4)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Accuracy:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {(trainingProgress.accuracy * 100).toFixed(2)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">ETA:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {trainingProgress.eta}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Training Visualization */}
            <div className="lg:col-span-2">
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Training Progress</h2>
                
                {trainingMetrics.length > 0 ? (
                  <div className="space-y-6">
                    {/* Loss Chart */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Loss</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trainingMetrics}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} name="Training Loss" />
                            <Line type="monotone" dataKey="validationLoss" stroke="#f59e0b" strokeWidth={2} name="Validation Loss" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Accuracy Chart */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Training Accuracy</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trainingMetrics}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} name="Training Accuracy" />
                            <Line type="monotone" dataKey="validationAccuracy" stroke="#3b82f6" strokeWidth={2} name="Validation Accuracy" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Data</h3>
                    <p className="text-gray-600">
                      Start training to see progress charts
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 