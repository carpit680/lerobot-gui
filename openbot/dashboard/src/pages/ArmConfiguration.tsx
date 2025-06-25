import { useState, useEffect, useRef } from 'react'
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

export default function ArmConfiguration() {
  const { armConfig, setArmConfig, cameras, setCameras, toggleCamera } = useLeRobotStore()
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

  useEffect(() => {
    setCameraList(cameras)
  }, [cameras])

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
    const promises = Array.from(streamingCameras).map(async (cameraId) => {
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 font-heading">Arm Configuration</h1>
        <p className="mt-2 text-gray-600">
          Configure the ports for your leader and follower robot arms
        </p>
      </div>

      {/* Arm Configuration Section */}
      <div className="mt-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Arm Configuration</h3>
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
                      Port
                    </label>
                    <select
                      value={armConfig.leaderPort}
                      onChange={(e) => handlePortChange('leader', e.target.value)}
                      className="input-field"
                      disabled={isScanning}
                    >
                      <option value="">{isScanning ? 'Scanning...' : 'Select Leader Arm Port'}</option>
                      {usbPorts.map((port) => (
                        <option key={port.path} value={port.path}>
                          {port.name} ({port.path})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Current port: <span className="font-medium">{armConfig.leaderPort || 'Not selected'}</span></p>
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
                      Port
                    </label>
                    <select
                      value={armConfig.followerPort}
                      onChange={(e) => handlePortChange('follower', e.target.value)}
                      className="input-field"
                      disabled={isScanning}
                    >
                      <option value="">{isScanning ? 'Scanning...' : 'Select Follower Arm Port'}</option>
                      {usbPorts.map((port) => (
                        <option key={port.path} value={port.path}>
                          {port.name} ({port.path})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Current port: <span className="font-medium">{armConfig.followerPort || 'Not selected'}</span></p>
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