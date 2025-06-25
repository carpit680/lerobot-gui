import { useState, useEffect, useRef } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline'

const BACKEND_URL = 'http://localhost:8000'

const robotTypes = [
  { id: 'so100', name: 'SO-100', description: '5-DOF robotic arm' },
  { id: 'giraffe', name: 'Giraffe v1.1', description: '6-DOF robotic arm' },
]

export default function Teleoperation() {
  const { armConfig, cameras } = useLeRobotStore()
  const [isTeleoperating, setIsTeleoperating] = useState(false)
  const [leaderType, setLeaderType] = useState('giraffe')
  const [followerType, setFollowerType] = useState('giraffe')
  const [leaderId, setLeaderId] = useState('giraffe_leader')
  const [followerId, setFollowerId] = useState('giraffe_follower')
  const [sessionId, setSessionId] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)
  const [selectedCameras, setSelectedCameras] = useState<string[]>([])
  const [jointPositions, setJointPositions] = useState<{[key: string]: number}>({})
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')
  const [updateFrequency, setUpdateFrequency] = useState<string>('')

  // Function to parse table data and extract joint positions
  const parseTableData = (tableText: string) => {
    const lines = tableText.split('\n')
    const positions: {[key: string]: number} = {}
    let timeInfo = ''
    let freqInfo = ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Parse joint positions (format: "joint_name.pos  |  value")
      if (trimmedLine.includes('.pos') && trimmedLine.includes('|')) {
        const parts = trimmedLine.split('|')
        if (parts.length === 2) {
          const jointName = parts[0].trim().replace('.pos', '')
          const value = parseFloat(parts[1].trim())
          if (!isNaN(value)) {
            positions[jointName] = value
          }
        }
      }
      
      // Parse timing information (format: "time: Xms (Y Hz)")
      if (trimmedLine.startsWith('time:')) {
        const timeMatch = trimmedLine.match(/time:\s*([\d.]+)ms\s*\(([\d.]+)\s*Hz\)/)
        if (timeMatch) {
          timeInfo = `${timeMatch[1]}ms`
          freqInfo = `${timeMatch[2]} Hz`
        }
      }
    }

    return { positions, timeInfo, freqInfo }
  }

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

  const handleCameraToggle = (cameraId: string) => {
    setSelectedCameras(prev => {
      if (prev.includes(cameraId)) {
        return prev.filter(id => id !== cameraId)
      } else {
        return [...prev, cameraId]
      }
    })
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
          })
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
        // Regular output (non-table) - add to status log
        const output = data.data
        // Filter out table-related lines from status log
        if (!output.includes('.pos') && 
            !output.includes('NAME') && 
            !output.includes('NORM') && 
            !output.includes('---------------------------') &&
            !output.includes('time:') &&
            !output.includes('ms') &&
            !output.includes('Hz')) {
          setOutput(prev => [...prev, output])
        }
      } else if (data.type === 'table') {
        // Table data - parse and update joint positions
        const { positions, timeInfo, freqInfo } = parseTableData(data.data)
        setJointPositions(positions)
        setLastUpdateTime(timeInfo)
        setUpdateFrequency(freqInfo)
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading">Teleoperation</h1>
        <p className="mt-2 text-gray-600">
          Control your robot arms manually with real-time feedback
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Teleoperation Configuration */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
            
            {/* Leader Arm Configuration */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3 border-b pb-2">Leader Arm</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arm Type</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">
                    {armConfig.leaderPort || <span className="text-gray-400">Not configured</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <input
                    type="text"
                    value={leaderId}
                    onChange={e => setLeaderId(e.target.value)}
                    className="input-field"
                    disabled={isTeleoperating}
                    placeholder="Enter leader arm ID"
                  />
                </div>
              </div>
            </div>

            {/* Follower Arm Configuration */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3 border-b pb-2">Follower Arm</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arm Type</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">
                    {armConfig.followerPort || <span className="text-gray-400">Not configured</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <input
                    type="text"
                    value={followerId}
                    onChange={e => setFollowerId(e.target.value)}
                    className="input-field"
                    disabled={isTeleoperating}
                    placeholder="Enter follower arm ID"
                  />
                </div>
              </div>
            </div>

            {/* Camera Selection */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3 border-b pb-2">Cameras</h4>
              <div className="space-y-2">
                {cameras.filter(c => c.enabled).length === 0 ? (
                  <p className="text-sm text-gray-500">No enabled cameras found. Configure cameras in Arm Configuration.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {cameras.filter(c => c.enabled).map(camera => (
                      <label key={camera.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCameras.includes(camera.id)}
                          onChange={() => handleCameraToggle(camera.id)}
                          disabled={isTeleoperating}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 truncate">{camera.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4 pt-4 border-t">
              <button
                onClick={startTeleoperation}
                disabled={isTeleoperating || !armConfig.leaderPort || !armConfig.followerPort || !leaderId.trim() || !followerId.trim() || backendConnected === false}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                Start Teleoperation
              </button>
              <button
                onClick={stopTeleoperation}
                disabled={!isTeleoperating}
                className="btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <StopIcon className="h-4 w-4 mr-2" />
                Stop
              </button>
            </div>
          </div>
        </div>

        {/* Teleoperation Output */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Joint Positions</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${backendConnected === true ? 'bg-green-500' : backendConnected === false ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {backendConnected === true ? 'Connected' : backendConnected === false ? 'Disconnected' : 'Checking...'}
                </span>
              </div>
            </div>
            
            {/* Joint Positions Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Joint</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.keys(jointPositions).length > 0 ? (
                    Object.entries(jointPositions).map(([joint, position]) => (
                      <tr key={joint} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {joint.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                          {position.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full mb-2"></div>
                          <p>No joint data available</p>
                          <p className="text-xs mt-1">Start teleoperation to see joint positions</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Timing Information */}
            {(lastUpdateTime || updateFrequency) && (
              <div className="mt-4 flex justify-between text-xs text-gray-500">
                <span>Update Time: {lastUpdateTime}</span>
                <span>Frequency: {updateFrequency}</span>
              </div>
            )}
          </div>
          
          {/* Status Log */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Status Log</h3>
            <div className="h-32 overflow-y-auto bg-gray-100 rounded p-3 text-xs font-mono whitespace-pre-wrap border">
              {output.length === 0 ? (
                <div className="text-gray-400 text-center py-4">
                  <p>No status messages yet.</p>
                  <p className="text-xs mt-1">Start teleoperation to see logs here.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {output.map((line, idx) => (
                    <div key={idx} className="py-1 border-b border-gray-200 last:border-b-0">
                      <pre className="whitespace-pre font-mono text-xs leading-tight overflow-x-auto">
                        {line}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {output.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 text-right">
                {output.length} log entries
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 