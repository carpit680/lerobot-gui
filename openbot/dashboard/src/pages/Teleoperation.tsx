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

interface JointControl {
  name: string
  value: number
  min: number
  max: number
  unit: string
}

export default function Teleoperation() {
  const { armConfig, cameras, setSessionState } = useLeRobotStore()
  const [isTeleoperating, setIsTeleoperating] = useState(false)
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [controlMode, setControlMode] = useState<'joint' | 'cartesian'>('joint')
  const [speed, setSpeed] = useState(50)
  
  const [jointControls, setJointControls] = useState<JointControl[]>([
    { name: 'Joint 1', value: 0, min: -180, max: 180, unit: '°' },
    { name: 'Joint 2', value: 0, min: -90, max: 90, unit: '°' },
    { name: 'Joint 3', value: 0, min: -180, max: 180, unit: '°' },
    { name: 'Joint 4', value: 0, min: -90, max: 90, unit: '°' },
    { name: 'Joint 5', value: 0, min: -180, max: 180, unit: '°' },
    { name: 'Joint 6', value: 0, min: -180, max: 180, unit: '°' },
  ])

  const [cartesianPosition, setCartesianPosition] = useState({
    x: 0,
    y: 0,
    z: 0,
    roll: 0,
    pitch: 0,
    yaw: 0
  })

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Set first enabled camera as default
    const enabledCamera = cameras.find(c => c.enabled)
    if (enabledCamera) {
      setSelectedCamera(enabledCamera.id)
    }
  }, [cameras])

  const startTeleoperation = () => {
    if (!armConfig.leaderConnected) {
      toast.error('Leader arm must be connected for teleoperation')
      return
    }

    setIsTeleoperating(true)
    setSessionState({ isTeleoperating: true })
    toast.success('Teleoperation started')
  }

  const stopTeleoperation = () => {
    setIsTeleoperating(false)
    setSessionState({ isTeleoperating: false })
    toast.success('Teleoperation stopped')
  }

  const updateJoint = (index: number, value: number) => {
    setJointControls(prev => prev.map((joint, i) => 
      i === index ? { ...joint, value } : joint
    ))
  }

  const updateCartesian = (axis: string, value: number) => {
    setCartesianPosition(prev => ({ ...prev, [axis]: value }))
  }

  const handleKeyPress = (event: KeyboardEvent) => {
    if (!isTeleoperating) return

    const step = speed / 10
    let updated = false

    switch (event.key) {
      case 'ArrowUp':
        if (controlMode === 'cartesian') {
          updateCartesian('y', cartesianPosition.y + step)
        } else {
          updateJoint(1, Math.min(jointControls[1].max, jointControls[1].value + step))
        }
        updated = true
        break
      case 'ArrowDown':
        if (controlMode === 'cartesian') {
          updateCartesian('y', cartesianPosition.y - step)
        } else {
          updateJoint(1, Math.max(jointControls[1].min, jointControls[1].value - step))
        }
        updated = true
        break
      case 'ArrowLeft':
        if (controlMode === 'cartesian') {
          updateCartesian('x', cartesianPosition.x - step)
        } else {
          updateJoint(0, Math.max(jointControls[0].min, jointControls[0].value - step))
        }
        updated = true
        break
      case 'ArrowRight':
        if (controlMode === 'cartesian') {
          updateCartesian('x', cartesianPosition.x + step)
        } else {
          updateJoint(0, Math.min(jointControls[0].max, jointControls[0].value + step))
        }
        updated = true
        break
    }

    if (updated) {
      event.preventDefault()
    }
  }

  useEffect(() => {
    if (isTeleoperating) {
      document.addEventListener('keydown', handleKeyPress)
      return () => document.removeEventListener('keydown', handleKeyPress)
    }
  }, [isTeleoperating, controlMode, speed, jointControls, cartesianPosition])

  const enabledCameras = cameras.filter(c => c.enabled)

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Teleoperation</h1>
            <p className="mt-2 text-gray-600">
              Manually control robot arms with real-time camera feedback
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

                {/* Camera Controls */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={startTeleoperation}
                      disabled={isTeleoperating || !armConfig.leaderConnected}
                      className="btn-primary disabled:opacity-50"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start
                    </button>
                    <button
                      onClick={stopTeleoperation}
                      disabled={!isTeleoperating}
                      className="btn-danger disabled:opacity-50"
                    >
                      <StopIcon className="h-4 w-4 mr-2" />
                      Stop
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Speed:</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-600 w-8">{speed}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <div className="space-y-6">
              {/* Control Mode */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Control Mode</h3>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="joint"
                      checked={controlMode === 'joint'}
                      onChange={(e) => setControlMode(e.target.value as 'joint' | 'cartesian')}
                      className="mr-2"
                    />
                    Joint Control
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="cartesian"
                      checked={controlMode === 'cartesian'}
                      onChange={(e) => setControlMode(e.target.value as 'joint' | 'cartesian')}
                      className="mr-2"
                    />
                    Cartesian Control
                  </label>
                </div>
              </div>

              {/* Joint Controls */}
              {controlMode === 'joint' && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Joint Control</h3>
                  <div className="space-y-4">
                    {jointControls.map((joint, index) => (
                      <div key={joint.name}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">
                            {joint.name}
                          </label>
                          <span className="text-sm text-gray-600">
                            {joint.value.toFixed(1)}{joint.unit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={joint.min}
                          max={joint.max}
                          value={joint.value}
                          onChange={(e) => updateJoint(index, Number(e.target.value))}
                          disabled={!isTeleoperating}
                          className="w-full disabled:opacity-50"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{joint.min}{joint.unit}</span>
                          <span>{joint.max}{joint.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cartesian Controls */}
              {controlMode === 'cartesian' && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Cartesian Control</h3>
                  <div className="space-y-4">
                    {Object.entries(cartesianPosition).map(([axis, value]) => (
                      <div key={axis}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700 capitalize">
                            {axis}
                          </label>
                          <span className="text-sm text-gray-600">
                            {value.toFixed(2)} {axis === 'x' || axis === 'y' || axis === 'z' ? 'mm' : '°'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={axis === 'x' || axis === 'y' || axis === 'z' ? -500 : -180}
                          max={axis === 'x' || axis === 'y' || axis === 'z' ? 500 : 180}
                          value={value}
                          onChange={(e) => updateCartesian(axis, Number(e.target.value))}
                          disabled={!isTeleoperating}
                          className="w-full disabled:opacity-50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyboard Controls */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Keyboard Controls</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div></div>
                  <div className="p-2 bg-gray-100 rounded">
                    <ArrowUpIcon className="h-4 w-4 mx-auto" />
                  </div>
                  <div></div>
                  <div className="p-2 bg-gray-100 rounded">
                    <ArrowLeftIcon className="h-4 w-4 mx-auto" />
                  </div>
                  <div className="p-2 bg-gray-100 rounded">
                    <ArrowDownIcon className="h-4 w-4 mx-auto" />
                  </div>
                  <div className="p-2 bg-gray-100 rounded">
                    <ArrowRightIcon className="h-4 w-4 mx-auto" />
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Use arrow keys to control movement
                </p>
              </div>

              {/* Status */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Leader Arm:</span>
                    <span className={armConfig.leaderConnected ? 'text-green-600' : 'text-red-600'}>
                      {armConfig.leaderConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Teleoperation:</span>
                    <span className={isTeleoperating ? 'text-green-600' : 'text-gray-600'}>
                      {isTeleoperating ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 