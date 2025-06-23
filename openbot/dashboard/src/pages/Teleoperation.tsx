import { useState, useEffect, useRef } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  VideoCameraIcon,
  PlayIcon,
  StopIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

const BACKEND_URL = 'http://localhost:8000'

const robotTypes = [
  { id: 'so100', name: 'SO-100', description: '5-DOF robotic arm' },
  { id: 'giraffe', name: 'Giraffe v1.1', description: '6-DOF robotic arm' },
]

export default function Teleoperation() {
  const { armConfig, cameras } = useLeRobotStore()
  const [isTeleoperating, setIsTeleoperating] = useState(false)
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [leaderType, setLeaderType] = useState('giraffe')
  const [followerType, setFollowerType] = useState('giraffe')
  const [leaderId, setLeaderId] = useState('giraffe_leader')
  const [followerId, setFollowerId] = useState('giraffe_follower')
  const [sessionId, setSessionId] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Set first enabled camera as default
    const enabledCamera = cameras.find(c => c.enabled)
    if (enabledCamera) {
      setSelectedCamera(enabledCamera.id)
    }
  }, [cameras])

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

  const startTeleoperation = async () => {
    const leaderPort = armConfig.leaderPort || ''
    const followerPort = armConfig.followerPort || ''
    if (!leaderPort || !followerPort) {
      toast.error('Please configure both leader and follower arm ports')
      return
    }
    if (!leaderId.trim() || !followerId.trim()) {
      toast.error('Please provide unique IDs for both arms')
      return
    }
    if (backendConnected !== true) {
      toast.error('Backend is not connected. Please start the Python backend server.')
      return
    }
    setIsTeleoperating(true)
    setIsRunning(true)
    setOutput([])
    try {
      const response = await fetch(`${BACKEND_URL}/teleop/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leader_type: `${leaderType}_leader`,
          leader_port: leaderPort,
          leader_id: leaderId,
          follower_type: `${followerType}_follower`,
          follower_port: followerPort,
          follower_id: followerId,
        })
      })
      if (!response.ok) throw new Error('Failed to start teleoperation')
      const result = await response.json()
      setSessionId(result.session_id)
      startWebSocketConnection(result.session_id)
    toast.success('Teleoperation started')
    } catch (error) {
      toast.error('Failed to start teleoperation')
      setIsTeleoperating(false)
      setIsRunning(false)
    }
  }

  const stopTeleoperation = async () => {
    if (!sessionId) return
    try {
      await fetch(`${BACKEND_URL}/teleop/stop/${sessionId}`, { method: 'DELETE' })
    setIsTeleoperating(false)
      setIsRunning(false)
      setSessionId('')
      setOutput([])
      if (websocket) {
        websocket.close()
        setWebsocket(null)
      }
    toast.success('Teleoperation stopped')
    } catch {
      toast.error('Failed to stop teleoperation')
    }
  }

  const startWebSocketConnection = (sessionId: string) => {
    const wsUrl = `ws://localhost:8000/ws/teleop/${sessionId}`
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
          setIsRunning(false)
          setIsTeleoperating(false)
          toast.success('Teleoperation finished')
        }
      } else if (data.type === 'error') {
        toast.error(`Teleoperation error: ${data.data}`)
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
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Teleoperation</h1>
            <p className="mt-2 text-gray-600">
              Start and monitor teleoperation between two robot arms
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Camera Feed */}
            <div className="lg:col-span-2">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 font-heading">Camera Feed</h2>
                  <div className="flex items-center gap-2">
                    <VideoCameraIcon className="h-5 w-5 text-gray-500" />
                    <select
                      value={selectedCamera}
                      onChange={(e) => setSelectedCamera(e.target.value)}
                      className="input-field w-auto"
                    >
                      {enabledCameras.map(camera => (
                        <option key={camera.id} value={camera.id}>
                          {camera.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                  {selectedCamera ? (
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover rounded-lg"
                      autoPlay
                      muted
                      loop
                    >
                      <source src={cameras.find(c => c.id === selectedCamera)?.url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="text-gray-400 text-center">
                      <VideoCameraIcon className="h-12 w-12 mx-auto mb-2" />
                      <p>No camera selected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Teleoperation Config & Output */}
            <div className="space-y-6">
              <div className="card space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Teleoperation Configuration</h3>
                {/* Leader Config */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leader Arm Type</label>
                  <select
                    value={leaderType}
                    onChange={e => setLeaderType(e.target.value)}
                    className="input-field"
                    disabled={isTeleoperating}
                  >
                    {robotTypes.map(robot => (
                      <option key={robot.id} value={robot.id}>{robot.name} - {robot.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leader Arm Port</label>
                  <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">
                    {armConfig.leaderPort || <span className="text-gray-400">Not configured</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leader Arm ID</label>
                        <input
                    type="text"
                    value={leaderId}
                    onChange={e => setLeaderId(e.target.value)}
                    className="input-field"
                    disabled={isTeleoperating}
                        />
                      </div>
                {/* Follower Config */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follower Arm Type</label>
                  <select
                    value={followerType}
                    onChange={e => setFollowerType(e.target.value)}
                    className="input-field"
                    disabled={isTeleoperating}
                  >
                    {robotTypes.map(robot => (
                      <option key={robot.id} value={robot.id}>{robot.name} - {robot.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follower Arm Port</label>
                  <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">
                    {armConfig.followerPort || <span className="text-gray-400">Not configured</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follower Arm ID</label>
                  <input
                    type="text"
                    value={followerId}
                    onChange={e => setFollowerId(e.target.value)}
                    className="input-field"
                    disabled={isTeleoperating}
                  />
                  </div>
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={startTeleoperation}
                    disabled={isTeleoperating || !armConfig.leaderPort || !armConfig.followerPort || !leaderId.trim() || !followerId.trim() || backendConnected === false}
                    className="btn-primary w-32 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Start
                  </button>
                  <button
                    onClick={stopTeleoperation}
                    disabled={!isTeleoperating}
                    className="btn-danger w-32 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <StopIcon className="h-4 w-4 mr-2" />
                    Stop
                  </button>
                </div>
              </div>
              {/* Output */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Teleoperation Output</h3>
                <div className="h-48 overflow-y-auto bg-gray-100 rounded p-2 text-xs font-mono whitespace-pre-wrap">
                  {output.length === 0 ? (
                    <span className="text-gray-400">No output yet.</span>
                  ) : (
                    output.map((line, idx) => <div key={idx}>{line}</div>)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 