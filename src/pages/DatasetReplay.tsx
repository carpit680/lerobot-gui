import { useState, useEffect } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline'

const BACKEND_URL = 'http://localhost:8000'

export default function DatasetReplay() {
  const { armConfig, hfUser, setHfUser } = useLeRobotStore()
  const [isReplaying, setIsReplaying] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)

  // Dataset replay configuration
  const [repoName, setRepoName] = useState('record-test')
  const [episode, setEpisode] = useState(0)

  // Get robot type and ID from store
  const robotType = armConfig.followerRobotType
  const robotId = armConfig.followerRobotId

  // Construct full dataset repo ID
  const datasetRepoId = hfUser && repoName ? `${hfUser}/${repoName}` : ''

  useEffect(() => {
    checkBackendConnection()
    const interval = setInterval(checkBackendConnection, 5000)
    return () => clearInterval(interval)
  }, [])

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`)
      setBackendConnected(response.ok)
    } catch {
      setBackendConnected(false)
    }
  }

  const startReplay = async () => {
    const robotPort = armConfig.followerPort || ''
    
    if (!robotPort) {
      toast.error('Please configure follower arm port')
      return
    }
    if (!robotType) {
      toast.error('Please configure robot type in Configuration')
      return
    }
    if (!robotId) {
      toast.error('Please configure robot ID in Configuration')
      return
    }
    if (backendConnected !== true) {
      toast.error('Backend is not connected. Please start the Python backend server.')
      return
    }
    if (!datasetRepoId) {
      toast.error('Please enter a Hugging Face username and repository name')
      return
    }

    setIsReplaying(true)
    setOutput([])
    try {
      const response = await fetch(`${BACKEND_URL}/dataset-replay/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robot_type: robotType,
          robot_port: robotPort,
          robot_id: robotId,
          dataset_repo_id: datasetRepoId,
          episode: episode
        })
      })
      if (!response.ok) throw new Error('Failed to start dataset replay')
      const result = await response.json()
      setSessionId(result.session_id)
      startWebSocketConnection(result.session_id)
      toast.success('Dataset replay started')
    } catch (error) {
      toast.error('Failed to start dataset replay')
      setIsReplaying(false)
    }
  }

  const stopReplay = async () => {
    if (!sessionId) return
    try {
      await fetch(`${BACKEND_URL}/dataset-replay/stop/${sessionId}`, { method: 'DELETE' })
      setIsReplaying(false)
      setSessionId('')
      setOutput([])
      if (websocket) {
        websocket.close()
        setWebsocket(null)
      }
      toast.success('Dataset replay stopped')
    } catch {
      toast.error('Failed to stop dataset replay')
    }
  }

  const startWebSocketConnection = (sessionId: string) => {
    const wsUrl = `ws://localhost:8000/ws/dataset-replay/${sessionId}`
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
          setIsReplaying(false)
          toast.success('Dataset replay finished')
        }
      } else if (data.type === 'error') {
        toast.error(`Dataset replay error: ${data.data}`)
      }
    }
    ws.onerror = () => {
      toast.error('WebSocket error')
    }
    ws.onclose = () => {
      setWebsocket(null)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading">Dataset Replay</h1>
        <p className="mt-2 text-gray-600">
          Replay recorded datasets using LeRobot's replay command
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Robot Configuration */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Robot Configuration</h3>
            
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

          {/* Dataset Configuration */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hugging Face Username
                </label>
                <input
                  type="text"
                  value={hfUser}
                  onChange={(e) => setHfUser(e.target.value)}
                  placeholder="Your HF username"
                  disabled={isReplaying}
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
                  disabled={isReplaying}
                  className="input-field disabled:opacity-50"
                />
                {hfUser && repoName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Full repository ID: {datasetRepoId}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Episode
                </label>
                <input
                  type="number"
                  value={episode}
                  onChange={(e) => setEpisode(parseInt(e.target.value) || 0)}
                  min="0"
                  disabled={isReplaying}
                  className="input-field disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="card">
            <div className="flex gap-4">
              <button
                onClick={startReplay}
                disabled={isReplaying || !armConfig.followerPort || !robotType || !robotId || backendConnected === false || !datasetRepoId}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                Start Replay
              </button>
              <button
                onClick={stopReplay}
                disabled={!isReplaying}
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
              <h3 className="text-lg font-semibold text-gray-900">Replay Status</h3>
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
                  isReplaying ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {isReplaying ? 'Replaying' : 'Stopped'}
                </span>
              </div>
              
              {isReplaying && (
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Replay Output</h3>
            <div className="h-96 overflow-y-auto bg-black text-green-400 rounded p-3 text-sm font-mono border">
              {output.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  <p>No output yet.</p>
                  <p className="text-xs mt-1">Start replay to see output here.</p>
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

          {/* Replay Tips */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Replay Tips</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Ensure the follower arm is connected and calibrated</p>
              <p>• Enter your Hugging Face username and repository name</p>
              <p>• Specify the episode number to replay (0 for first episode)</p>
              <p>• The system will automatically construct the full repository ID</p>
              <p>• Monitor the output log for any errors or warnings</p>
              <p>• The replay will use the exact CLI command: python -m lerobot.replay</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 