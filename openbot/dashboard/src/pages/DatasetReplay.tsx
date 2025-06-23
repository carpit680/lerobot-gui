import { useState, useEffect, useRef } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  BackwardIcon,
  ForwardIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

interface ReplayState {
  isPlaying: boolean
  isPaused: boolean
  currentFrame: number
  totalFrames: number
  playbackSpeed: number
  loop: boolean
}

export default function DatasetReplay() {
  const { datasets, armConfig, setSessionState } = useLeRobotStore()
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    isPaused: false,
    currentFrame: 0,
    totalFrames: 0,
    playbackSpeed: 1,
    loop: false
  })
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (selectedDataset) {
      const dataset = datasets.find(d => d.id === selectedDataset)
      if (dataset) {
        setReplayState(prev => ({
          ...prev,
          totalFrames: dataset.frameCount,
          currentFrame: 0
        }))
      }
    }
  }, [selectedDataset, datasets])

  useEffect(() => {
    if (replayState.isPlaying && !replayState.isPaused) {
      intervalRef.current = setInterval(() => {
        setReplayState(prev => {
          const nextFrame = prev.currentFrame + 1
          if (nextFrame >= prev.totalFrames) {
            if (prev.loop) {
              return { ...prev, currentFrame: 0 }
            } else {
              return { ...prev, isPlaying: false, currentFrame: 0 }
            }
          }
          return { ...prev, currentFrame: nextFrame }
        })
      }, 1000 / (30 * replayState.playbackSpeed)) // 30 FPS base
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
  }, [replayState.isPlaying, replayState.isPaused, replayState.playbackSpeed, replayState.loop])

  const startReplay = () => {
    if (!selectedDataset) {
      toast.error('Please select a dataset to replay')
      return
    }

    if (!armConfig.followerConnected) {
      toast.error('Follower arm must be connected for replay')
      return
    }

    setReplayState(prev => ({ ...prev, isPlaying: true, isPaused: false }))
    setSessionState({ isReplaying: true })
    toast.success('Replay started')
  }

  const pauseReplay = () => {
    setReplayState(prev => ({ ...prev, isPaused: true }))
    toast.success('Replay paused')
  }

  const resumeReplay = () => {
    setReplayState(prev => ({ ...prev, isPaused: false }))
    toast.success('Replay resumed')
  }

  const stopReplay = () => {
    setReplayState(prev => ({ 
      ...prev, 
      isPlaying: false, 
      isPaused: false, 
      currentFrame: 0 
    }))
    setSessionState({ isReplaying: false })
    toast.success('Replay stopped')
  }

  const seekToFrame = (frame: number) => {
    setReplayState(prev => ({ ...prev, currentFrame: Math.max(0, Math.min(frame, prev.totalFrames - 1)) }))
  }

  const skipBackward = () => {
    setReplayState(prev => ({ 
      ...prev, 
      currentFrame: Math.max(0, prev.currentFrame - Math.floor(prev.totalFrames * 0.1))
    }))
  }

  const skipForward = () => {
    setReplayState(prev => ({ 
      ...prev, 
      currentFrame: Math.min(prev.totalFrames - 1, prev.currentFrame + Math.floor(prev.totalFrames * 0.1))
    }))
  }

  const formatTime = (frame: number) => {
    const fps = 30 // Assuming 30 FPS
    const seconds = frame / fps
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatProgress = (current: number, total: number) => {
    return ((current / total) * 100).toFixed(1)
  }

  const selectedDatasetData = datasets.find(d => d.id === selectedDataset)

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Dataset Replay</h1>
            <p className="mt-2 text-gray-600">
              Replay recorded datasets on the follower arm
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Video Player */}
            <div className="lg:col-span-2">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 font-heading">Video Player</h2>
                  {selectedDatasetData && (
                    <div className="text-sm text-gray-600">
                      {selectedDatasetData.name}
                    </div>
                  )}
                </div>

                <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center mb-4">
                  {selectedDataset ? (
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover rounded-lg"
                      autoPlay={replayState.isPlaying && !replayState.isPaused}
                      muted
                      loop={replayState.loop}
                    >
                      <source src="/sample-video.mp4" type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="text-gray-400 text-center">
                      <EyeIcon className="h-12 w-12 mx-auto mb-2" />
                      <p>No dataset selected</p>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {selectedDataset && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{formatTime(replayState.currentFrame)}</span>
                      <span>{formatTime(replayState.totalFrames)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-100"
                        style={{ width: `${formatProgress(replayState.currentFrame, replayState.totalFrames)}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={replayState.totalFrames - 1}
                      value={replayState.currentFrame}
                      onChange={(e) => seekToFrame(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    onClick={skipBackward}
                    disabled={!selectedDataset}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <BackwardIcon className="h-5 w-5" />
                  </button>

                  {!replayState.isPlaying ? (
                    <button
                      onClick={startReplay}
                      disabled={!selectedDataset || !armConfig.followerConnected}
                      className="btn-primary disabled:opacity-50"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start
                    </button>
                  ) : (
                    <>
                      {!replayState.isPaused ? (
                        <button
                          onClick={pauseReplay}
                          className="btn-secondary"
                        >
                          <PauseIcon className="h-4 w-4 mr-2" />
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={resumeReplay}
                          className="btn-primary"
                        >
                          <PlayIcon className="h-4 w-4 mr-2" />
                          Resume
                        </button>
                      )}
                      <button
                        onClick={stopReplay}
                        className="btn-danger"
                      >
                        <StopIcon className="h-4 w-4 mr-2" />
                        Stop
                      </button>
                    </>
                  )}

                  <button
                    onClick={skipForward}
                    disabled={!selectedDataset}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ForwardIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <div className="space-y-6">
              {/* Dataset Selection */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset Selection</h3>
                
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
                        <h4 className="font-medium text-gray-900 truncate">
                          {dataset.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {dataset.frameCount} frames • {Math.round(dataset.duration / 60)} min
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(dataset.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Playback Settings */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Playback Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Playback Speed
                    </label>
                    <select
                      value={replayState.playbackSpeed}
                      onChange={(e) => setReplayState(prev => ({ 
                        ...prev, 
                        playbackSpeed: Number(e.target.value) 
                      }))}
                      className="input-field"
                    >
                      <option value={0.25}>0.25x (Slow)</option>
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x (Normal)</option>
                      <option value={2}>2x (Fast)</option>
                      <option value={4}>4x (Very Fast)</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="loop"
                      checked={replayState.loop}
                      onChange={(e) => setReplayState(prev => ({ 
                        ...prev, 
                        loop: e.target.checked 
                      }))}
                      className="mr-2"
                    />
                    <label htmlFor="loop" className="text-sm text-gray-700">
                      Loop playback
                    </label>
                  </div>
                </div>
              </div>

              {/* Replay Status */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Replay Status</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`text-sm font-medium ${
                      replayState.isPlaying && !replayState.isPaused ? 'text-green-600' :
                      replayState.isPaused ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {replayState.isPlaying && !replayState.isPaused ? 'Playing' :
                       replayState.isPaused ? 'Paused' : 'Stopped'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Progress:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatProgress(replayState.currentFrame, replayState.totalFrames)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Frame:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {replayState.currentFrame.toLocaleString()} / {replayState.totalFrames.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Speed:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {replayState.playbackSpeed}x
                    </span>
                  </div>
                </div>
              </div>

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
                    <span className="text-gray-600">Replay:</span>
                    <span className={replayState.isPlaying ? 'text-green-600' : 'text-gray-600'}>
                      {replayState.isPlaying ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Replay Tips */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Replay Tips</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Ensure follower arm is connected and calibrated</p>
                  <p>• Use playback speed controls to adjust replay speed</p>
                  <p>• Use seek bar to jump to specific frames</p>
                  <p>• Enable loop for continuous replay</p>
                  <p>• Monitor arm movement during replay</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 