import { useState, useEffect, useRef } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  VideoCameraIcon,
  PlayIcon,
  StopIcon,
  PauseIcon,
} from '@heroicons/react/24/outline'

interface RecordingSession {
  id: string
  name: string
  startTime: Date
  duration: number
  frameCount: number
  size: number
  cameras: string[]
  status: 'recording' | 'paused' | 'stopped'
}

export default function DatasetRecording() {
  const { armConfig, cameras, setSessionState, addDataset } = useLeRobotStore()
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [selectedCameras, setSelectedCameras] = useState<string[]>([])
  const [sessionName, setSessionName] = useState('')
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null)
  
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Set first enabled camera as default
    const enabledCameras = cameras.filter(c => c.enabled)
    if (enabledCameras.length > 0) {
      setSelectedCameras([enabledCameras[0].id])
    }
  }, [cameras])

  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
        setFrameCount(prev => prev + selectedCameras.length) // One frame per camera
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording, isPaused, selectedCameras])

  const startRecording = () => {
    if (!sessionName.trim()) {
      toast.error('Please enter a session name')
      return
    }

    if (selectedCameras.length === 0) {
      toast.error('Please select at least one camera')
      return
    }

    if (!armConfig.leaderConnected) {
      toast.error('Leader arm must be connected for recording')
      return
    }

    const session: RecordingSession = {
      id: Date.now().toString(),
      name: sessionName,
      startTime: new Date(),
      duration: 0,
      frameCount: 0,
      size: 0,
      cameras: selectedCameras,
      status: 'recording'
    }

    setCurrentSession(session)
    setIsRecording(true)
    setIsPaused(false)
    setRecordingDuration(0)
    setFrameCount(0)
    setSessionState({ isRecording: true })
    toast.success('Recording started')
  }

  const pauseRecording = () => {
    setIsPaused(true)
    if (currentSession) {
      setCurrentSession(prev => prev ? { ...prev, status: 'paused' } : null)
    }
    toast.success('Recording paused')
  }

  const resumeRecording = () => {
    setIsPaused(false)
    if (currentSession) {
      setCurrentSession(prev => prev ? { ...prev, status: 'recording' } : null)
    }
    toast.success('Recording resumed')
  }

  const stopRecording = () => {
    if (!currentSession) return

    setIsRecording(false)
    setIsPaused(false)
    setSessionState({ isRecording: false })

    // Calculate final session data
    const finalSession = {
      ...currentSession,
      duration: recordingDuration,
      frameCount,
      size: frameCount * 1024 * 1024, // Simulate 1MB per frame
      status: 'stopped' as const
    }

    // Add to datasets
    addDataset({
      id: finalSession.id,
      name: finalSession.name,
      path: `/datasets/${finalSession.name}_${finalSession.id}`,
      size: finalSession.size,
      createdAt: finalSession.startTime.toISOString(),
      duration: finalSession.duration,
      frameCount: finalSession.frameCount
    })

    setCurrentSession(null)
    setSessionName('')
    setRecordingDuration(0)
    setFrameCount(0)
    toast.success('Recording stopped and saved')
  }

  const toggleCamera = (cameraId: string) => {
    setSelectedCameras(prev => 
      prev.includes(cameraId)
        ? prev.filter(id => id !== cameraId)
        : [...prev, cameraId]
    )
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const enabledCameras = cameras.filter(c => c.enabled)

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading">Dataset Recording</h1>
        <p className="mt-2 text-gray-600">
          Record training datasets for your robot arms
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Camera Feeds */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 font-heading">Camera Feeds</h2>
              <div className="flex items-center gap-2">
                <VideoCameraIcon className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {selectedCameras.length} selected
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {enabledCameras.map(camera => (
                <div key={camera.id} className="relative">
                  <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={el => videoRefs.current[camera.id] = el}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                    >
                      <source src={camera.url} type="video/mp4" />
                    </video>
                    
                    {/* Camera Selection Overlay */}
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={selectedCameras.includes(camera.id)}
                        onChange={() => toggleCamera(camera.id)}
                        className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-2">{camera.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="space-y-6">
          {/* Session Configuration */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Enter session name"
                  disabled={isRecording}
                  className="input-field disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Cameras
                </label>
                <div className="space-y-2">
                  {enabledCameras.map(camera => (
                    <label key={camera.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedCameras.includes(camera.id)}
                        onChange={() => toggleCamera(camera.id)}
                        disabled={isRecording}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">{camera.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recording Controls */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recording Controls</h3>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={!armConfig.leaderConnected || selectedCameras.length === 0}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Start Recording
                  </button>
                ) : (
                  <>
                    {!isPaused ? (
                      <button
                        onClick={pauseRecording}
                        className="btn-secondary flex-1"
                      >
                        <PauseIcon className="h-4 w-4 mr-2" />
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={resumeRecording}
                        className="btn-primary flex-1"
                      >
                        <PlayIcon className="h-4 w-4 mr-2" />
                        Resume
                      </button>
                    )}
                    <button
                      onClick={stopRecording}
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

          {/* Recording Status */}
          {(isRecording || currentSession) && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recording Status</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`text-sm font-medium ${
                    isRecording && !isPaused ? 'text-green-600' :
                    isPaused ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {isRecording && !isPaused ? 'Recording' :
                     isPaused ? 'Paused' : 'Stopped'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Duration:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDuration(recordingDuration)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Frames:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {frameCount.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Size:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Math.round(frameCount * 1024 / 1024)} MB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Leader Arm:</span>
                <span className={armConfig.leaderConnected ? 'text-green-600' : 'text-red-600'}>
                  {armConfig.leaderConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Follower Arm:</span>
                <span className={armConfig.followerConnected ? 'text-green-600' : 'text-red-600'}>
                  {armConfig.followerConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Available Cameras:</span>
                <span className="text-gray-900">{enabledCameras.length}</span>
              </div>
            </div>
          </div>

          {/* Recording Tips */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recording Tips</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Ensure both arms are connected and calibrated</p>
              <p>• Select cameras that provide good coverage of the workspace</p>
              <p>• Use descriptive session names for easy identification</p>
              <p>• Monitor recording duration and storage space</p>
              <p>• Pause recording if you need to adjust setup</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 