import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  CogIcon,
} from '@heroicons/react/24/outline'
import { CameraConfig } from '../store/lerobotStore'

interface UsbPort {
  path: string
  name: string
  connected: boolean
  lastSeen: Date
}

const robotTypes = [
  { value: 'so100_leader', label: 'SO-100 Leader' },
  { value: 'so100_follower', label: 'SO-100 Follower' },
  { value: 'giraffe_leader', label: 'Giraffe v1.1 Leader' },
  { value: 'giraffe_follower', label: 'Giraffe v1.1 Follower' },
]

export default function Configuration() {
  const location = useLocation()
  const { armConfig, setArmConfig, cameras, setCameras, toggleCamera, hfUser, setHfUser, hfToken, setHfToken } = useLeRobotStore()
  const [usbPorts, setUsbPorts] = useState<UsbPort[]>([])
  const [isScanning, setIsScanning] = useState(false)
  // Camera management state
  const [cameraList, setCameraList] = useState<CameraConfig[]>(cameras)
  const [isScanningCameras, setIsScanningCameras] = useState(false)
  const [streamingCameras, setStreamingCameras] = useState<Set<string>>(new Set())
  const [streamTimestamps, setStreamTimestamps] = useState<Map<string, number>>(new Map())
  const [motorConfigArm, setMotorConfigArm] = useState<'leader' | 'follower'>('leader');
  const [motorConfigRobot, setMotorConfigRobot] = useState('SO-100');
  const [isRunningMotorConfig, setIsRunningMotorConfig] = useState(false);
  const [motorConfigOutput, setMotorConfigOutput] = useState('');
  const [motorConfigWaiting, setMotorConfigWaiting] = useState(false);
  const motorConfigPort = motorConfigArm === 'leader' ? armConfig.leaderPort : armConfig.followerPort;
  let motorConfigSocket = useRef<WebSocket | null>(null);
  const [motorConfigSessionId, setMotorConfigSessionId] = useState<string | null>(null);
  const [isSendingMotorInput, setIsSendingMotorInput] = useState(false);
  const [envLoaded, setEnvLoaded] = useState(false);

  // Debounced robot ID states
  const [leaderRobotIdInput, setLeaderRobotIdInput] = useState(armConfig.leaderRobotId)
  const [followerRobotIdInput, setFollowerRobotIdInput] = useState(armConfig.followerRobotId)
  const leaderRobotIdTimeoutRef = useRef<number | null>(null)
  const followerRobotIdTimeoutRef = useRef<number | null>(null)
  const isOnConfigPage = useRef(true)
  const streamingCamerasRef = useRef(streamingCameras)

  useEffect(() => {
    setCameraList(cameras)
  }, [cameras])

  // Fetch Hugging Face environment variables from backend
  useEffect(() => {
    const fetchHfEnv = async () => {
      try {
        const response = await fetch('http://localhost:8000/env/huggingface')
        if (response.ok) {
          const data = await response.json()
          // Only update if we don't already have values set
          if (data.hf_user && !hfUser) {
            setHfUser(data.hf_user)
          }
          if (data.hf_token && !hfToken) {
            setHfToken(data.hf_token)
          }
          setEnvLoaded(true)
        }
      } catch (error) {
        console.warn('Failed to fetch Hugging Face environment variables:', error)
        setEnvLoaded(true) // Mark as loaded even if failed
      }
    }
    
    fetchHfEnv()
  }, [hfUser, hfToken, setHfUser, setHfToken])

  // Cleanup: Stop all camera streams on unmount
  useEffect(() => {
    return () => {
      stopAllCameraStreams();
    };
  }, []);

  // Scan for USB ports
  const scanUsbPorts = async () => {
    setIsScanning(true)
    try {
      // Fetch real USB devices from backend
      const response = await fetch('http://localhost:8000/detect-ports')
      if (!response.ok) {
        throw new Error('Failed to fetch USB ports')
      }
      const data = await response.json()
      // data.ports is an array of port paths
      const realPorts: UsbPort[] = (data.ports || []).map((path: string) => ({
        path,
        name: `USB Device (${path})`,
        connected: true,
        lastSeen: new Date()
      }))
      setUsbPorts(realPorts)
    } catch (error) {
      console.error('Error scanning USB ports:', error)
      toast.error('Failed to scan USB ports')
      setUsbPorts([])
    } finally {
      setIsScanning(false)
    }
  }

  const handlePortChange = (armType: 'leader' | 'follower', port: string) => {
    setArmConfig({
      [`${armType}Port`]: port
    })
    toast.success(`${armType.charAt(0).toUpperCase() + armType.slice(1)} arm port set to ${port}`)
  }

  const handleRobotTypeChange = (armType: 'leader' | 'follower', robotType: string) => {
    const fullRobotType = robotType ? `${robotType}_${armType}` : ''
    setArmConfig({
      [`${armType}RobotType`]: fullRobotType
    })
    const displayName = robotType === 'so100' ? 'SO-100' : robotType === 'giraffe' ? 'Giraffe v1.1' : robotType
    toast.success(`${armType.charAt(0).toUpperCase() + armType.slice(1)} arm robot type set to ${displayName}`)
  }

  const handleRobotIdChange = (armType: 'leader' | 'follower', robotId: string) => {
    if (armType === 'leader') {
      setLeaderRobotIdInput(robotId)
      // Clear existing timeout
      if (leaderRobotIdTimeoutRef.current) {
        clearTimeout(leaderRobotIdTimeoutRef.current)
      }
      // Set new timeout
      leaderRobotIdTimeoutRef.current = setTimeout(() => {
        setArmConfig({
          leaderRobotId: robotId
        })
        toast.success(`Leader arm robot ID set to ${robotId}`)
      }, 1000)
    } else {
      setFollowerRobotIdInput(robotId)
      // Clear existing timeout
      if (followerRobotIdTimeoutRef.current) {
        clearTimeout(followerRobotIdTimeoutRef.current)
      }
      // Set new timeout
      followerRobotIdTimeoutRef.current = setTimeout(() => {
        setArmConfig({
          followerRobotId: robotId
        })
        toast.success(`Follower arm robot ID set to ${robotId}`)
      }, 1000)
    }
  }

  const handleToggleCamera = (id: string) => {
    toggleCamera(id)
  }

  const handleToggleStreaming = async (camera: CameraConfig) => {
    const cameraIndex = camera.id.replace('camera', '')
    const isCurrentlyStreaming = streamingCameras.has(camera.id)
    
    if (isCurrentlyStreaming) {
      // Stop streaming
      try {
        await fetch(`http://localhost:8000/camera/${cameraIndex}/stop`, { method: 'DELETE' })
        setStreamingCameras(prev => {
          const newSet = new Set(prev)
          newSet.delete(camera.id)
          return newSet
        })
        setStreamTimestamps(prev => {
          const newMap = new Map(prev)
          newMap.delete(camera.id)
          return newMap
        })
        toast.success(`Stopped streaming from ${camera.name}`)
      } catch (error) {
        toast.error(`Failed to stop streaming from ${camera.name}`)
      }
    } else {
      // Start streaming
      try {
        await fetch(`http://localhost:8000/camera/${cameraIndex}/start`, { method: 'POST' })
        // Small delay to ensure backend stream is ready
        await new Promise(resolve => setTimeout(resolve, 500))
        setStreamingCameras(prev => new Set([...prev, camera.id]))
        setStreamTimestamps(prev => new Map([...prev, [camera.id, Date.now()]]))
        toast.success(`Started streaming from ${camera.name}`)
      } catch (error) {
        toast.error(`Failed to start streaming from ${camera.name}`)
      }
    }
  }

  const stopAllCameraStreams = async () => {
    const cameras = Array.from(streamingCamerasRef.current)
    const promises = cameras.map(async (cameraId) => {
      const cameraIndex = cameraId.replace('camera', '')
      try {
        await fetch(`http://localhost:8000/camera/${cameraIndex}/stop`, { method: 'DELETE' })
      } catch (error) {
        console.error(`Failed to stop camera ${cameraIndex}:`, error)
      }
    })
    await Promise.all(promises)
    setStreamingCameras(new Set())
    setStreamTimestamps(new Map())
  }

  const handleScanCameras = async () => {
    setIsScanningCameras(true)
    try {
      const response = await fetch('http://localhost:8000/scan-cameras')
      if (!response.ok) throw new Error('Failed to scan cameras')
      const data = await response.json()
      
      // Map backend cameras to CameraConfig
      const scannedCameras: CameraConfig[] = (data.cameras || []).map((cam: any) => ({
        id: cam.id,
        name: cam.name,
        url: `/video/camera/${cam.index}`,
        enabled: true,
        index: cam.index,
        width: cam.width || 1920,
        height: cam.height || 1080,
        fps: cam.fps || 30,
      }))
      
      // Create a map of scanned cameras
      const scannedCamerasMap = new Map(scannedCameras.map(cam => [cam.id, cam]))
      
      // Preserve existing cameras that are currently streaming
      const existingCameras = cameraList.filter(cam => streamingCameras.has(cam.id))
      
      // Merge scanned cameras with existing streaming cameras
      const mergedCameras = [
        ...scannedCameras,
        ...existingCameras.filter(existing => !scannedCamerasMap.has(existing.id))
      ]
      
      // Preserve existing states for all cameras
      const existingCamerasMap = new Map(cameraList.map(cam => [cam.id, cam]))
      const finalCameras = mergedCameras.map(camera => {
        const existing = existingCamerasMap.get(camera.id)
        if (existing) {
          // Preserve existing enabled state and other properties
          return {
            ...camera,
            enabled: existing.enabled,
          }
        }
        return camera
      })
      
      setCameras(finalCameras)
      toast.success('Cameras scanned')
    } catch (e) {
      toast.error('Failed to scan cameras')
    } finally {
      setIsScanningCameras(false)
    }
  }

  const getMotorConfigType = () => {
    if (motorConfigRobot === 'SO-100') {
      return motorConfigArm === 'leader' ? 'so100_leader' : 'so100_follower';
    } else if (motorConfigRobot === 'Giraffe') {
      return motorConfigArm === 'leader' ? 'giraffe_leader' : 'giraffe_follower';
    }
    return '';
  };

  async function runMotorConfigSession() {
    setIsRunningMotorConfig(true);
    setMotorConfigOutput('');
    setMotorConfigWaiting(false);
    setMotorConfigSessionId(null);
    if (motorConfigSocket.current) {
      motorConfigSocket.current.close();
    }
    // Start session
    const resp = await fetch('http://localhost:8000/motor-setup/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        robot_type: getMotorConfigType(),
        port: motorConfigPort,
      })
    });
    if (!resp.ok) {
      setMotorConfigOutput('Failed to start motor setup.');
      setIsRunningMotorConfig(false);
      return;
    }
    const data = await resp.json();
    const sessionId = data.session_id;
    setMotorConfigSessionId(sessionId);
    // Open WebSocket
    const ws = new WebSocket(`ws://localhost:8000/ws/motor-setup/${sessionId}`);
    motorConfigSocket.current = ws;
    ws.onopen = () => {
      console.log('[MotorConfigWS] WebSocket opened');
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output') {
        setMotorConfigOutput(prev => prev + msg.data);
        // Detect waiting for input in output
        if (msg.data.toLowerCase().includes('press enter')) {
          setMotorConfigWaiting(true);
        }
      }
      if (msg.type === 'status' && msg.data.status === 'finished') {
        setIsRunningMotorConfig(false);
        setMotorConfigWaiting(false);
        ws.close();
      }
      if (msg.type === 'error') {
        setMotorConfigOutput(prev => prev + '\nERROR: ' + msg.data);
        setIsRunningMotorConfig(false);
        setMotorConfigWaiting(false);
        ws.close();
      }
    };
    ws.onerror = (e) => {
      setMotorConfigOutput(prev => prev + '\nWebSocket error.');
      setIsRunningMotorConfig(false);
      setMotorConfigWaiting(false);
      ws.close();
      console.error('[MotorConfigWS] WebSocket error', e);
    };
    ws.onclose = (e) => {
      console.log('[MotorConfigWS] WebSocket closed', e);
    };
  }

  async function sendMotorConfigContinue() {
    if (!motorConfigSessionId) return;
    setIsSendingMotorInput(true);
    await fetch('http://localhost:8000/motor-setup/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: motorConfigSessionId, input_data: '\n' })
    });
    setMotorConfigWaiting(false);
    setIsSendingMotorInput(false);
  }

  async function cancelMotorConfig() {
    if (!motorConfigSessionId) return;
    await fetch(`http://localhost:8000/motor-setup/stop/${motorConfigSessionId}`, { method: 'DELETE' });
    setIsRunningMotorConfig(false);
    setMotorConfigWaiting(false);
    setMotorConfigSessionId(null);
    setMotorConfigOutput('[INFO] Motor setup cancelled by user');
    if (motorConfigSocket.current) {
      motorConfigSocket.current.close();
    }
  }

  useEffect(() => {
    return () => {
      if (motorConfigSocket.current) {
        motorConfigSocket.current.close();
      }
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (leaderRobotIdTimeoutRef.current) {
        clearTimeout(leaderRobotIdTimeoutRef.current)
      }
      if (followerRobotIdTimeoutRef.current) {
        clearTimeout(followerRobotIdTimeoutRef.current)
      }
    }
  }, [])

  // Update input values when store values change
  useEffect(() => {
    setLeaderRobotIdInput(armConfig.leaderRobotId)
  }, [armConfig.leaderRobotId])

  useEffect(() => {
    setFollowerRobotIdInput(armConfig.followerRobotId)
  }, [armConfig.followerRobotId])

  // Stop camera streams when navigating away from this page
  useEffect(() => {
    console.log('Arm Configuration component mounted')
    
    const handleBeforeUnload = () => {
      console.log('Page unload detected, stopping camera streams')
      stopAllCameraStreams()
    }

    // Add event listener for page unload
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup function that runs when component unmounts
    return () => {
      console.log('Configuration component unmounting, stopping camera streams')
      window.removeEventListener('beforeunload', handleBeforeUnload)
      stopAllCameraStreams()
    }
  }, [])

  // Track when we're on the configuration page
  useEffect(() => {
    isOnConfigPage.current = true
    return () => {
      isOnConfigPage.current = false
    }
  }, [])

  useEffect(() => {
    streamingCamerasRef.current = streamingCameras
  }, [streamingCameras])

  useEffect(() => {
    if (location.pathname !== '/configuration') {
      stopAllCameraStreams()
    }
  }, [location.pathname])

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading">Configuration</h1>
        <p className="mt-2 text-gray-600">
          Configure robot arms, cameras, and system settings
        </p>
      </div>

      {/* Hugging Face Credentials Section */}
      <div className="mt-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hugging Face Credentials</h3>
          <div className="space-y-4">
            {envLoaded && (hfUser || hfToken) && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ Loaded from system environment variables
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hugging Face Username</label>
              <input
                type="text"
                className="input-field"
                value={hfUser}
                onChange={e => setHfUser(e.target.value)}
                placeholder="Enter your Hugging Face username"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Access Token</label>
              <input
                type="password"
                className="input-field"
                value={hfToken}
                onChange={e => setHfToken(e.target.value)}
                placeholder="Enter your Hugging Face access token"
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500 mt-1">
                {hfToken ? 'Token is set.' : 'No token set. Required for Hugging Face API access.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Robot Configuration Section */}
      <div className="mt-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Robot Configuration</h3>
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={scanUsbPorts}
                className="btn-primary px-4 py-2 rounded disabled:opacity-50"
                disabled={isScanning}
              >
                {isScanning ? 'Scanning...' : 'Scan for Ports'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CogIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 font-heading">Leader Arm</h2>
                    <p className="text-sm text-gray-600">Primary control arm</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Port Selection
                    </label>
                    <select
                      value={armConfig.leaderPort}
                      onChange={(e) => setArmConfig({ leaderPort: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select a port</option>
                      {usbPorts.map((port) => (
                        <option key={port.path} value={port.path}>
                          {port.name} ({port.path})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Robot Type
                    </label>
                    <select
                      value={armConfig.leaderRobotType}
                      onChange={(e) => setArmConfig({ leaderRobotType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select robot type</option>
                      {robotTypes.filter(type => type.value.endsWith('_leader')).map((type) => (
                        <option key={type.value} value={type.value}>{type.value}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Robot ID
                    </label>
                    <input
                      type="text"
                      placeholder="Enter robot ID"
                      value={leaderRobotIdInput}
                      onChange={(e) => {
                        setLeaderRobotIdInput(e.target.value)
                        if (leaderRobotIdTimeoutRef.current) {
                          clearTimeout(leaderRobotIdTimeoutRef.current)
                        }
                        leaderRobotIdTimeoutRef.current = window.setTimeout(() => {
                          setArmConfig({ leaderRobotId: e.target.value })
                          toast.success('Leader arm robot ID saved')
                        }, 1000)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CogIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 font-heading">Follower Arm</h2>
                    <p className="text-sm text-gray-600">Secondary controlled arm</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Port Selection
                    </label>
                    <select
                      value={armConfig.followerPort}
                      onChange={(e) => setArmConfig({ followerPort: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select a port</option>
                      {usbPorts.map((port) => (
                        <option key={port.path} value={port.path}>
                          {port.name} ({port.path})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Robot Type
                    </label>
                    <select
                      value={armConfig.followerRobotType}
                      onChange={(e) => setArmConfig({ followerRobotType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select robot type</option>
                      {robotTypes.filter(type => type.value.endsWith('_follower')).map((type) => (
                        <option key={type.value} value={type.value}>{type.value}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Robot ID
                    </label>
                    <input
                      type="text"
                      placeholder="Enter robot ID"
                      value={followerRobotIdInput}
                      onChange={(e) => {
                        setFollowerRobotIdInput(e.target.value)
                        if (followerRobotIdTimeoutRef.current) {
                          clearTimeout(followerRobotIdTimeoutRef.current)
                        }
                        followerRobotIdTimeoutRef.current = window.setTimeout(() => {
                          setArmConfig({ followerRobotId: e.target.value })
                          toast.success('Follower arm robot ID saved')
                        }, 1000)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Configuration Section */}
      <div className="mt-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Camera Configuration</h3>
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={handleScanCameras}
                className="btn-primary px-4 py-2 rounded disabled:opacity-50"
                disabled={isScanningCameras}
              >
                {isScanningCameras ? 'Scanning...' : 'Scan Cameras'}
              </button>
            </div>
            
            <div className="space-y-2">
              {cameraList.length === 0 ? (
                <p className="text-sm text-gray-500">No cameras found. Click "Scan Cameras" to detect available cameras.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cameraList.map((camera) => (
                    <div key={camera.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium text-gray-900">{camera.name}</div>
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-4">
                        <div>Index: {camera.index}</div>
                        <div>Resolution: {camera.width}×{camera.height}</div>
                        <div>FPS: {camera.fps}</div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <label 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleToggleCamera(camera.id)}
                          >
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                              camera.enabled ? 'bg-blue-600' : 'bg-gray-300'
                            }`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                                camera.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </div>
                            <span className="text-sm text-gray-700">Enabled</span>
                          </label>
                          <input
                            type="checkbox"
                            checked={camera.enabled}
                            onChange={() => handleToggleCamera(camera.id)}
                            className="sr-only"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <label 
                            className={`flex items-center gap-2 ${!camera.enabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            onClick={() => camera.enabled && handleToggleStreaming(camera)}
                          >
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                              streamingCameras.has(camera.id) ? 'bg-green-600' : 'bg-gray-300'
                            } ${!camera.enabled ? 'opacity-50' : ''}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                                streamingCameras.has(camera.id) ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </div>
                            <span className={`text-sm ${!camera.enabled ? 'text-gray-400' : 'text-gray-700'}`}>Stream</span>
                          </label>
                          <input
                            type="checkbox"
                            checked={streamingCameras.has(camera.id)}
                            onChange={() => handleToggleStreaming(camera)}
                            disabled={!camera.enabled}
                            className="sr-only"
                          />
                        </div>
                      </div>

                      {/* Video preview */}
                      {camera.enabled && streamingCameras.has(camera.id) && (
                        <div className="mt-4">
                          <img
                            key={`${camera.id}-${streamTimestamps.get(camera.id) || 0}`}
                            src={`http://localhost:8000${camera.url}?t=${streamTimestamps.get(camera.id) || Date.now()}`}
                            className="w-full rounded border"
                            alt={`${camera.name} preview`}
                            onError={(e) => {
                              console.error('Image error for camera:', camera.id, e);
                              e.currentTarget.style.display = 'none';
                            }}
                            onLoad={() => console.log('Image loaded for camera:', camera.id)}
                          />
                          <div className="text-xs text-gray-500 mt-1 text-center">
                            Live Stream
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Motor Configuration Section */}
      <div className="mt-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Motor Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {/* Arm Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arm</label>
              <select
                value={motorConfigArm}
                onChange={e => setMotorConfigArm(e.target.value as 'leader' | 'follower')}
                className="input-field"
              >
                <option value="leader">Leader Arm</option>
                <option value="follower">Follower Arm</option>
              </select>
            </div>
            {/* Robot Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Robot Type</label>
              <select
                value={motorConfigRobot}
                onChange={e => setMotorConfigRobot(e.target.value)}
                className="input-field"
              >
                <option value="SO-100">SO-100</option>
                <option value="Giraffe">Giraffe</option>
              </select>
            </div>
            {/* Run Button */}
            <div>
              <button
                className="btn-primary w-full"
                disabled={isRunningMotorConfig || !motorConfigPort}
                onClick={runMotorConfigSession}
              >
                {isRunningMotorConfig ? 'Running...' : 'Run Motor Setup'}
              </button>
            </div>
          </div>
          {/* Output */}
          {motorConfigOutput && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-sm font-mono whitespace-pre-wrap max-h-64 overflow-auto border">
              {motorConfigOutput}
            </div>
          )}
          {motorConfigWaiting && (
            <button
              className="btn-primary bg-yellow-600 hover:bg-yellow-700 border-yellow-600 w-full mt-2"
              onClick={sendMotorConfigContinue}
              disabled={isSendingMotorInput}
            >
              {isSendingMotorInput ? 'Sending...' : 'Continue'}
            </button>
          )}
          {isRunningMotorConfig && (
            <button
              className="btn-secondary bg-red-600 hover:bg-red-700 border-red-600 text-white w-full mt-2"
              onClick={cancelMotorConfig}
              disabled={isSendingMotorInput}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 