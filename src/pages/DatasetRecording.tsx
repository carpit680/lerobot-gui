import { useState, useEffect } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  PlayIcon,
  StopIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'

const BACKEND_URL = 'http://localhost:8000'

export default function DatasetRecording() {
  const { armConfig, cameras, hfUser, setHfUser } = useLeRobotStore()
  const [isRecording, setIsRecording] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)
  const [selectedCameras, setSelectedCameras] = useState<string[]>([])

  // Dataset recording configuration
  const [repoName, setRepoName] = useState('record-test')
  const [numEpisodes, setNumEpisodes] = useState(5)
  const [singleTask, setSingleTask] = useState('')
  const [pushToHub, setPushToHub] = useState(false)
  const [resume, setResume] = useState(true)
  const [episodeTimeS, setEpisodeTimeS] = useState(60)
  const [resetTimeS, setResetTimeS] = useState(60)
  const [displayData, setDisplayData] = useState(true)

  // Get robot type and ID from store
  const robotType = armConfig.followerRobotType
  const teleopType = armConfig.leaderRobotType
  const robotId = armConfig.followerRobotId
  const teleopId = armConfig.leaderRobotId

  // Construct full dataset repo ID
  const datasetRepoId = hfUser && repoName ? `${hfUser}/${repoName}` : ''

  useEffect(() => {
    checkBackendConnection()
    const interval = setInterval(checkBackendConnection, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Set first enabled camera as default
    const enabledCameras = cameras.filter(c => c.enabled)
    if (enabledCameras.length > 0) {
      setSelectedCameras([enabledCameras[0].id])
    }
  }, [cameras])

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`)
      setBackendConnected(response.ok)
    } catch {
      setBackendConnected(false)
    }
  }

  const handleCameraToggle = (cameraId: string) => {
    setSelectedCameras(prev => {
      if (prev.includes(cameraId)) {
        return prev.filter(id => id !== cameraId)
      } else {
        return [...prev, cameraId]
      }
    })
  }

  const startRecording = async () => {
    const robotPort = armConfig.followerPort || ''
    const teleopPort = armConfig.leaderPort || ''
    
    if (!robotPort || !teleopPort) {
      toast.error('Please configure both leader and follower arm ports')
      return
    }
    if (!robotType || !teleopType) {
      toast.error('Please configure robot types for both arms in Arm Configuration')
      return
    }
    if (!robotId || !teleopId) {
      toast.error('Please configure robot IDs for both arms in Arm Configuration')
      return
    }
    if (backendConnected !== true) {
      toast.error('Backend is not connected. Please start the Python backend server.')
      return
    }
    if (!singleTask.trim()) {
      toast.error('Please enter a task description')
      return
    }
    if (pushToHub && !datasetRepoId) {
      toast.error('Please enter a Hugging Face username and repository name when pushing to hub')
      return
    }

    setIsRecording(true)
    setOutput([])
    try {
      const response = await fetch(`${BACKEND_URL}/dataset-recording/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robot_type: robotType,
          robot_port: robotPort,
          robot_id: robotId,
          teleop_type: teleopType,
          teleop_port: teleopPort,
          teleop_id: teleopId,
          cameras: selectedCameras.map(cameraId => {
            const camera = cameras.find(c => c.id === cameraId)
            return {
              name: camera?.name || cameraId,
              index: camera?.index || parseInt(cameraId.replace('camera', '')),
              width: camera?.width || 1920,
              height: camera?.height || 1080,
              fps: camera?.fps || 30,
              type: 'opencv'
            }
          }),
          display_data: displayData,
          dataset_repo_id: datasetRepoId || undefined,
          num_episodes: numEpisodes,
          single_task: singleTask,
          push_to_hub: pushToHub,
          resume: resume,
          episode_time_s: episodeTimeS,
          reset_time_s: resetTimeS
        })
      })
      if (!response.ok) throw new Error('Failed to start dataset recording')
      const result = await response.json()
      setSessionId(result.session_id)
      startWebSocketConnection(result.session_id)
      toast.success('Dataset recording started')
    } catch (error) {
      toast.error('Failed to start dataset recording')
      setIsRecording(false)
    }
  }

  const stopRecording = async () => {
    if (!sessionId) return
    try {
      await fetch(`${BACKEND_URL}/dataset-recording/stop/${sessionId}`, { method: 'DELETE' })
      setIsRecording(false)
      setSessionId('')
      setOutput([])
      if (websocket) {
        websocket.close()
        setWebsocket(null)
      }
      toast.success('Dataset recording stopped')
    } catch {
      toast.error('Failed to stop dataset recording')
    }
  }

  const startWebSocketConnection = (sessionId: string) => {
    const wsUrl = `ws://localhost:8000/ws/dataset-recording/${sessionId}`
    const ws = new WebSocket(wsUrl)
    setWebsocket(ws)
    ws.onopen = () => {
      //
    }
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'output') {
        setOutput(prev => [...prev, data.data])
      } else if (data.type === 'status') {
        if (data.data.status === 'finished') {
          setIsRecording(false)
          toast.success('Dataset recording finished')
        }
      } else if (data.type === 'error') {
        toast.error(`Dataset recording error: ${data.data}`)
      }
    }
    ws.onerror = () => {
      toast.error('WebSocket error')
    }
    ws.onclose = () => {
      setWebsocket(null)
    }
  }

  const enabledCameras = cameras.filter(c => c.enabled)

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading">Dataset Recording</h1>
        <p className="mt-2 text-gray-600">
          Record training datasets using LeRobot's record command
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Robot Configuration */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Robot Configuration</h3>
            
            {/* Robot Arm Configuration */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3 border-b pb-2">Robot Arm (Follower)</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arm Type</label>
                  <div className="input-field bg-gray-50 text-gray-700">
                    {robotType || 'Not configured'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">
                    {armConfig.followerPort || <span className="text-gray-400">Not configured</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <div className="input-field bg-gray-50 text-gray-700">
                    {robotId || 'Not configured'}
                  </div>
                </div>
              </div>
            </div>

            {/* Teleop Arm Configuration */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3 border-b pb-2">Teleop Arm (Leader)</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arm Type</label>
                  <div className="input-field bg-gray-50 text-gray-700">
                    {teleopType || 'Not configured'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">
                    {armConfig.leaderPort || <span className="text-gray-400">Not configured</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <div className="input-field bg-gray-50 text-gray-700">
                    {teleopId || 'Not configured'}
                  </div>
                </div>
              </div>
            </div>

            {/* Camera Selection */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3 border-b pb-2">Cameras</h4>
              <div className="space-y-2">
                {enabledCameras.length === 0 ? (
                  <p className="text-sm text-gray-500">No enabled cameras found. Configure cameras in Arm Configuration.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {enabledCameras.map(camera => (
                      <label key={camera.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCameras.includes(camera.id)}
                          onChange={() => handleCameraToggle(camera.id)}
                          disabled={isRecording}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 truncate">{camera.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dataset Configuration */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Description *
                </label>
                <input
                  type="text"
                  value={singleTask}
                  onChange={(e) => setSingleTask(e.target.value)}
                  placeholder="e.g., Grab the black cube"
                  disabled={isRecording}
                  className="input-field disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Episodes
                </label>
                <input
                  type="number"
                  value={numEpisodes}
                  onChange={(e) => setNumEpisodes(parseInt(e.target.value) || 5)}
                  min="1"
                  max="100"
                  disabled={isRecording}
                  className="input-field disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Episode Time (seconds)
                </label>
                <input
                  type="number"
                  value={episodeTimeS}
                  onChange={(e) => setEpisodeTimeS(parseInt(e.target.value) || 60)}
                  min="10"
                  max="600"
                  disabled={isRecording}
                  className="input-field disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reset Time (seconds)
                </label>
                <input
                  type="number"
                  value={resetTimeS}
                  onChange={(e) => setResetTimeS(parseInt(e.target.value) || 60)}
                  min="10"
                  max="600"
                  disabled={isRecording}
                  className="input-field disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hugging Face Username
                </label>
                <input
                  type="text"
                  value={hfUser}
                  onChange={(e) => setHfUser(e.target.value)}
                  placeholder="Your HF username"
                  disabled={isRecording}
                  className="input-field disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="record-test"
                  disabled={isRecording}
                  className="input-field disabled:opacity-50"
                />
                {hfUser && repoName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Full repository ID: {datasetRepoId}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={pushToHub}
                    onChange={(e) => setPushToHub(e.target.checked)}
                    disabled={isRecording}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Push to Hugging Face Hub</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={resume}
                    onChange={(e) => setResume(e.target.checked)}
                    disabled={isRecording}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Resume from previous session</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={displayData}
                    onChange={(e) => setDisplayData(e.target.checked)}
                    disabled={isRecording}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Display data during recording</span>
                </label>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="card">
            <div className="flex gap-4">
              <button
                onClick={startRecording}
                disabled={isRecording || !armConfig.leaderPort || !armConfig.followerPort || !robotType || !teleopType || !robotId || !teleopId || backendConnected === false || !singleTask.trim()}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                Start Recording
              </button>
              <button
                onClick={stopRecording}
                disabled={!isRecording}
                className="btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <StopIcon className="h-4 w-4 mr-2" />
                Stop
              </button>
            </div>
          </div>
        </div>

        {/* Output Panel */}
        <div className="space-y-6">
          {/* Status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recording Status</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${backendConnected === true ? 'bg-green-500' : backendConnected === false ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {backendConnected === true ? 'Connected' : backendConnected === false ? 'Disconnected' : 'Checking...'}
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`text-sm font-medium ${
                  isRecording ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {isRecording ? 'Recording' : 'Stopped'}
                </span>
              </div>
              
              {isRecording && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Session ID:</span>
                  <span className="text-sm font-mono text-gray-900 truncate max-w-xs">
                    {sessionId}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Output Log */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Recording Output</h3>
            <div className="h-96 overflow-y-auto bg-black text-green-400 rounded p-3 text-sm font-mono border">
              {output.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  <p>No output yet.</p>
                  <p className="text-xs mt-1">Start recording to see output here.</p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">
                  {output.join('\n')}
                </div>
              )}
            </div>
            {output.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 text-right">
                {output.length} log entries
              </div>
            )}
          </div>

          {/* Recording Tips */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recording Tips</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Ensure both arms are connected and calibrated</p>
              <p>• Provide a clear task description for better dataset quality</p>
              <p>• Set appropriate episode and reset times for your task</p>
              <p>• Use Hugging Face Hub for dataset sharing and versioning</p>
              <p>• Monitor the output log for any errors or warnings</p>
              <p>• The recording will automatically stop after the specified number of episodes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 