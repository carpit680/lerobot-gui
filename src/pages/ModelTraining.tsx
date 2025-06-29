import React, { useState, useEffect } from 'react'
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

interface TrainingConfig {
  dataset_repo_id: string
  policy_type: string
  output_dir: string
  job_name: string
  policy_device: string
  wandb_enable: boolean
  resume: boolean
}

interface TrainingStatus {
  isRunning: boolean
  isCompleted: boolean
  error: string | null
  output: string[]
  wandbLink: string | null
}

interface Dataset {
  id: string
  name: string
  author: string
  description: string
  tags: string[]
}

export default function ModelTraining() {
  const { hfUser, hfToken } = useLeRobotStore()
  const [config, setConfig] = useState<TrainingConfig>({
    dataset_repo_id: '',
    policy_type: 'act',
    output_dir: '',
    job_name: '',
    policy_device: 'cuda',
    wandb_enable: true,
    resume: false,
  })
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>({
    isRunning: false,
    isCompleted: false,
    error: null,
    output: [],
    wandbLink: null
  })
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [policyRepoName, setPolicyRepoName] = useState<string>('my_policy')

  // Fetch LeRobot datasets when component mounts
  useEffect(() => {
    if (hfUser) {
      fetchLeRobotDatasets()
    }
  }, [hfUser])

  // Update config when selections change
  useEffect(() => {
    if (hfUser) {
      const datasetRepoId = selectedDataset || `${hfUser}/so101_test`
      const policyRepoId = `${hfUser}/${policyRepoName}`
      const jobName = `act_${policyRepoName}`
      const outputDir = `outputs/train/act_${policyRepoName}`

      setConfig(prev => ({
        ...prev,
        dataset_repo_id: datasetRepoId,
        output_dir: outputDir,
        job_name: jobName,
      }))
    }
  }, [hfUser, selectedDataset, policyRepoName])

  const fetchLeRobotDatasets = async () => {
    if (!hfUser) return

    setLoadingDatasets(true)
    try {
      // Use Hugging Face API directly
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      if (hfToken) {
        headers['Authorization'] = `Bearer ${hfToken}`
      }

      const response = await fetch(`https://huggingface.co/api/datasets?author=${hfUser}&limit=100`, {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        console.log('HF API Response:', data) // Debug log
        
        // Filter datasets that have LeRobot tag
        const lerobotDatasets = data.filter((dataset: any) => 
          dataset.tags && dataset.tags.includes('LeRobot')
        ).map((dataset: any) => ({
          id: dataset.id || dataset.full_name,
          name: dataset.name || dataset.id?.split('/')?.[1] || 'Unknown',
          author: dataset.author || dataset.id?.split('/')?.[0] || hfUser,
          description: dataset.description || 'No description available',
          tags: dataset.tags || []
        }))
        
        console.log('Filtered LeRobot datasets:', lerobotDatasets) // Debug log
        setDatasets(lerobotDatasets)
        
        // Set default selection if available
        if (lerobotDatasets.length > 0) {
          setSelectedDataset(lerobotDatasets[0].id)
        }
      } else {
        console.error('Failed to fetch datasets from Hugging Face API:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('Error fetching datasets:', err)
    } finally {
      setLoadingDatasets(false)
    }
  }

  const handleConfigChange = (field: keyof TrainingConfig, value: string | boolean | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const startTraining = async () => {
    setTrainingStatus({
      isRunning: true,
      isCompleted: false,
      error: null,
      output: [],
      wandbLink: null
    })

    try {
      const response = await fetch('http://localhost:8000/model-training/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config,
          token: hfToken || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to start training')
      }

      // Start polling for training output
      pollTrainingOutput()
    } catch (err) {
      setTrainingStatus(prev => ({
        ...prev,
        isRunning: false,
        error: err instanceof Error ? err.message : 'Failed to start training'
      }))
    }
  }

  const clearOutput = () => {
    setTrainingStatus(prev => ({
      ...prev,
      output: [],
      wandbLink: null
    }))
  }

  // Extract W&B link from training output
  const extractWandbLink = (output: string[]): string | null => {
    for (const line of output) {
      // Look for any line containing a W&B URL
      const match = line.match(/(https:\/\/wandb\.ai\/[^\s]+)/)
      if (match) {
        return match[1]
      }
    }
    return null
  }

  const pollTrainingOutput = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:8000/model-training/status')
        const data = await response.json()

        if (data.is_completed) {
          const newOutput = data.output || trainingStatus.output
          setTrainingStatus(prev => ({
            ...prev,
            isRunning: false,
            isCompleted: true,
            output: newOutput,
            wandbLink: extractWandbLink(newOutput)
          }))
          clearInterval(pollInterval)
        } else if (data.error) {
          setTrainingStatus(prev => ({
            ...prev,
            isRunning: false,
            error: data.error
          }))
          clearInterval(pollInterval)
        } else {
          const newOutput = data.output || trainingStatus.output
          setTrainingStatus(prev => ({
            ...prev,
            output: newOutput,
            wandbLink: extractWandbLink(newOutput)
          }))
        }
      } catch (err) {
        console.error('Error polling training status:', err)
      }
    }, 1000) // Poll every second

    // Cleanup interval after 30 minutes (1800000 ms) to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval)
      setTrainingStatus(prev => ({
        ...prev,
        isRunning: false,
        error: 'Training polling timeout - check backend logs for status'
      }))
    }, 1800000)
  }

  const stopTraining = async () => {
    try {
      await fetch('http://localhost:8000/model-training/stop', {
        method: 'POST',
      })
      setTrainingStatus(prev => ({
        ...prev,
        isRunning: false
      }))
    } catch (err) {
      console.error('Error stopping training:', err)
    }
  }

  if (!hfUser) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Hugging Face Username Required
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Please configure your Hugging Face username in the Configuration page to start model training.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Model Training</h1>
        <p className="text-gray-600">
          Configure and run LeRobot model training with your datasets
        </p>
        <div className="mt-2 text-sm text-gray-500">
          User: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{hfUser}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Training Configuration</h2>
          </div>
          <div className="p-6 space-y-4">
                <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dataset Repository
                  </label>
              {loadingDatasets ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Loading datasets...
                  </div>
                </div>
              ) : (
                  <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {datasets.length === 0 ? (
                    <option value="">No LeRobot datasets found</option>
                  ) : (
                    datasets.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name || dataset.id}
                      </option>
                    ))
                  )}
                  </select>
              )}
                  <p className="text-xs text-gray-500 mt-1">
                Selected: {config.dataset_repo_id}
                  </p>
                </div>

                <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy Type
                  </label>
              <select
                value={config.policy_type}
                onChange={(e) => handleConfigChange('policy_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="act">ACT</option>
                <option value="diffusion">Diffusion</option>
                <option value="transformer">Transformer</option>
              </select>
                </div>

                <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy Repository Name
                  </label>
                  <input
                    type="text"
                value={policyRepoName}
                onChange={(e) => setPolicyRepoName(e.target.value)}
                placeholder="my_policy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Full path: {`${hfUser}/${policyRepoName}`}
              </p>
                </div>

                <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy Device
                  </label>
              <select
                value={config.policy_device}
                onChange={(e) => handleConfigChange('policy_device', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="cuda">CUDA</option>
                <option value="mps">Apple Silicon</option>
              </select>
            </div>

            <div className="flex items-center">
                      <input
                        type="checkbox"
                id="wandb_enable"
                checked={config.wandb_enable}
                onChange={(e) => handleConfigChange('wandb_enable', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="wandb_enable" className="ml-2 block text-sm text-gray-700">
                Enable Weights & Biases logging
              </label>
                        </div>

            <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="resume"
                    checked={config.resume}
                    onChange={(e) => handleConfigChange('resume', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="resume" className="ml-2 block text-sm text-gray-700">
                Resume from checkpoint (continue training if output directory exists)
                  </label>
                </div>

            {/* Configuration Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Configuration Summary</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div><span className="font-medium">Dataset:</span> {config.dataset_repo_id}</div>
                <div><span className="font-medium">Policy:</span> {`${hfUser}/${policyRepoName}`}</div>
                <div><span className="font-medium">Output:</span> {config.output_dir}</div>
                <div><span className="font-medium">Job:</span> {config.job_name}</div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
                    <button
                      onClick={startTraining}
                disabled={trainingStatus.isRunning || datasets.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                {trainingStatus.isRunning ? 'Training...' : 'Start Training'}
                    </button>
              {trainingStatus.isRunning && (
                      <button
                        onClick={stopTraining}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Stop
                      </button>
                  )}
                </div>
              </div>
            </div>

        {/* Training Output */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Training Output</h2>
              <div className="flex items-center gap-2">
                {trainingStatus.wandbLink && (
                  <a
                    href={trainingStatus.wandbLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    View in W&B
                  </a>
                )}
              <button
                onClick={clearOutput}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
              </div>
                  </div>
                  </div>
          <div className="p-6">
            {trainingStatus.error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Training Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{trainingStatus.error}</p>
                  </div>
                  </div>
                </div>
              </div>
            )}

            {trainingStatus.isCompleted && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Training Completed</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Training has finished successfully.</p>
                      {trainingStatus.wandbLink && config.wandb_enable && (
                        <div className="mt-2">
                          <a
                            href={trainingStatus.wandbLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium"
                          >
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            View training metrics in Weights & Biases
                          </a>
                        </div>
                      )}
                </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
              {trainingStatus.output.length === 0 ? (
                <div className="text-gray-500">
                  Training output will appear here...
                </div>
              ) : (
                trainingStatus.output.map((line, index) => (
                  <div key={index} className="whitespace-pre-wrap">{line}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 