import { useState, useEffect } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  ChartBarIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface DatasetStats {
  totalFrames: number
  averageFrameRate: number
  jointRanges: { [key: string]: { min: number; max: number; avg: number } }
  trajectoryLength: number
  timeDistribution: { [key: string]: number }
}

export default function DatasetVisualization() {
  const { datasets, removeDataset } = useLeRobotStore()
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'trajectory' | 'joints' | 'timeline'>('overview')

  // Generate mock data for visualization
  const generateMockData = (datasetId: string) => {
    const frameCount = datasets.find(d => d.id === datasetId)?.frameCount || 1000
    const mockData = []
    
    for (let i = 0; i < Math.min(frameCount, 100); i++) {
      mockData.push({
        frame: i,
        joint1: Math.sin(i * 0.1) * 30 + Math.random() * 10,
        joint2: Math.cos(i * 0.15) * 20 + Math.random() * 8,
        joint3: Math.sin(i * 0.2) * 25 + Math.random() * 12,
        x: Math.sin(i * 0.05) * 100 + Math.random() * 20,
        y: Math.cos(i * 0.08) * 80 + Math.random() * 15,
        z: 200 + Math.sin(i * 0.12) * 50 + Math.random() * 10,
        timestamp: i * 0.1
      })
    }
    
    return mockData
  }

  const generateStats = (datasetId: string): DatasetStats => {
    const dataset = datasets.find(d => d.id === datasetId)
    if (!dataset) return {} as DatasetStats

    return {
      totalFrames: dataset.frameCount,
      averageFrameRate: dataset.frameCount / dataset.duration,
      jointRanges: {
        'Joint 1': { min: -45, max: 45, avg: 0 },
        'Joint 2': { min: -30, max: 30, avg: 5 },
        'Joint 3': { min: -60, max: 60, avg: -10 },
        'Joint 4': { min: -90, max: 90, avg: 15 },
        'Joint 5': { min: -180, max: 180, avg: 0 },
        'Joint 6': { min: -180, max: 180, avg: 45 }
      },
      trajectoryLength: Math.sqrt(dataset.frameCount * 100),
      timeDistribution: {
        'Movement': 60,
        'Grasping': 20,
        'Transport': 15,
        'Placement': 5
      }
    }
  }

  useEffect(() => {
    if (selectedDataset) {
      setDatasetStats(generateStats(selectedDataset))
    }
  }, [selectedDataset, datasets])

  const handleDeleteDataset = (datasetId: string) => {
    if (confirm('Are you sure you want to delete this dataset?')) {
      removeDataset(datasetId)
      if (selectedDataset === datasetId) {
        setSelectedDataset('')
        setDatasetStats(null)
      }
      toast.success('Dataset deleted')
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const mockData = selectedDataset ? generateMockData(selectedDataset) : []

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Dataset Visualization</h1>
            <p className="mt-2 text-gray-600">
              Analyze and visualize recorded datasets
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Dataset List */}
            <div className="lg:col-span-1">
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 font-heading mb-4">Datasets</h2>
                
                <div className="space-y-3">
                  {datasets.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No datasets available</p>
                  ) : (
                    datasets.map(dataset => (
                      <div
                        key={dataset.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedDataset === dataset.id
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedDataset(dataset.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 truncate">
                              {dataset.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {new Date(dataset.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>{dataset.frameCount} frames</span>
                              <span>{formatFileSize(dataset.size)}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteDataset(dataset.id)
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Visualization Area */}
            <div className="lg:col-span-3">
              {selectedDataset && datasetStats ? (
                <div className="space-y-6">
                  {/* Dataset Info */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 font-heading">
                        {datasets.find(d => d.id === selectedDataset)?.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        <button className="btn-secondary">
                          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                          Export
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">
                          {datasetStats.totalFrames.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Frames</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {datasetStats.averageFrameRate.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600">FPS</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatDuration(datasets.find(d => d.id === selectedDataset)?.duration || 0)}
                        </div>
                        <div className="text-sm text-gray-600">Duration</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {formatFileSize(datasets.find(d => d.id === selectedDataset)?.size || 0)}
                        </div>
                        <div className="text-sm text-gray-600">Size</div>
                      </div>
                    </div>
                  </div>

                  {/* View Mode Tabs */}
                  <div className="card">
                    <div className="flex items-center gap-4 mb-4">
                      <button
                        onClick={() => setViewMode('overview')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          viewMode === 'overview'
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Overview
                      </button>
                      <button
                        onClick={() => setViewMode('trajectory')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          viewMode === 'trajectory'
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Trajectory
                      </button>
                      <button
                        onClick={() => setViewMode('joints')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          viewMode === 'joints'
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Joints
                      </button>
                      <button
                        onClick={() => setViewMode('timeline')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          viewMode === 'timeline'
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Timeline
                      </button>
                    </div>

                    {/* Overview Chart */}
                    {viewMode === 'overview' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Distribution</h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={Object.entries(datasetStats.timeDistribution).map(([key, value]) => ({
                                activity: key,
                                percentage: value
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="activity" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="percentage" fill="#3b82f6" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Joint Ranges</h3>
                            <div className="space-y-3">
                              {Object.entries(datasetStats.jointRanges).map(([joint, range]) => (
                                <div key={joint}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">{joint}</span>
                                    <span className="text-gray-900">
                                      {range.min}° - {range.max}° (avg: {range.avg}°)
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-primary-600 h-2 rounded-full"
                                      style={{
                                        width: `${((range.max - range.min) / 360) * 100}%`,
                                        marginLeft: `${((range.avg + 180) / 360) * 100}%`
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trajectory Overview</h3>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={mockData.slice(0, 50)}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="frame" />
                                  <YAxis />
                                  <Tooltip />
                                  <Line type="monotone" dataKey="x" stroke="#ef4444" strokeWidth={2} />
                                  <Line type="monotone" dataKey="y" stroke="#10b981" strokeWidth={2} />
                                  <Line type="monotone" dataKey="z" stroke="#3b82f6" strokeWidth={2} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Trajectory Chart */}
                    {viewMode === 'trajectory' && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">3D Trajectory</h3>
                        <div className="h-96">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mockData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="x" />
                              <YAxis dataKey="y" />
                              <Tooltip />
                              <Line type="monotone" dataKey="z" stroke="#3b82f6" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Joint Charts */}
                    {viewMode === 'joints' && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Joint Angles Over Time</h3>
                        <div className="h-96">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mockData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="timestamp" />
                              <YAxis />
                              <Tooltip />
                              <Line type="monotone" dataKey="joint1" stroke="#ef4444" strokeWidth={2} />
                              <Line type="monotone" dataKey="joint2" stroke="#10b981" strokeWidth={2} />
                              <Line type="monotone" dataKey="joint3" stroke="#3b82f6" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {viewMode === 'timeline' && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
                        <div className="space-y-4">
                          {Object.entries(datasetStats.timeDistribution).map(([activity, percentage]) => (
                            <div key={activity} className="flex items-center gap-4">
                              <div className="w-24 text-sm font-medium text-gray-700">
                                {activity}
                              </div>
                              <div className="flex-1 bg-gray-200 rounded-full h-4">
                                <div
                                  className="bg-primary-600 h-4 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="w-16 text-sm text-gray-600 text-right">
                                {percentage}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="text-center py-12">
                    <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Dataset Selected</h3>
                    <p className="text-gray-600">
                      Select a dataset from the list to view its visualization
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 