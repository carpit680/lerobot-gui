import { useState, useEffect } from 'react'
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
        toast.success(`Stopped streaming from ${camera.name}`)
      } catch (error) {
        toast.error(`Failed to stop streaming from ${camera.name}`)
      }
    } else {
      // Start streaming
      try {
        await fetch(`http://localhost:8000/camera/${cameraIndex}/start`, { method: 'POST' })
        setStreamingCameras(prev => new Set([...prev, camera.id]))
        toast.success(`Started streaming from ${camera.name}`)
      } catch (error) {
        toast.error(`Failed to start streaming from ${camera.name}`)
      }
    }
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
      }))
      setCameras(scannedCameras)
      toast.success('Cameras scanned')
    } catch (e) {
      toast.error('Failed to scan cameras')
    } finally {
      setIsScanningCameras(false)
    }
  }

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Arm Configuration</h1>
            <p className="mt-2 text-gray-600">
              Configure the ports for your leader and follower robot arms
            </p>
          </div>

          {/* Scan for Ports Button */}
          <div className="mb-6 flex justify-end">
            <button
              onClick={scanUsbPorts}
              className="btn-primary px-4 py-2 rounded disabled:opacity-50"
              disabled={isScanning}
            >
              {isScanning ? 'Scanning...' : 'Scan for Ports'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card">
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

            <div className="card">
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

          <div className="mt-8">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration Summary</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>• Leader Arm Port: <span className="font-medium text-gray-900">{armConfig.leaderPort || 'Not configured'}</span></p>
                <p>• Follower Arm Port: <span className="font-medium text-gray-900">{armConfig.followerPort || 'Not configured'}</span></p>
                <p>• These ports will be used for all arm operations throughout the application</p>
                <p>• Make sure your arms are connected to the selected ports before using other features</p>
                {usbPorts.length === 0 && (
                  <p className="text-orange-600">• No USB devices currently detected. Please connect your arms and refresh.</p>
                )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {cameraList.length === 0 && (
                    <div className="text-gray-500 col-span-2">No cameras configured.</div>
                  )}
                  {cameraList.map((camera) => (
                    <div key={camera.id} className="border rounded-lg p-4 flex flex-col gap-2 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">{camera.name}</div>
                      </div>
                      <div className="text-xs text-gray-600 break-all">{camera.url}</div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={camera.enabled}
                            onChange={() => handleToggleCamera(camera.id)}
                            id={`toggle-${camera.id}`}
                          />
                          <label htmlFor={`toggle-${camera.id}`} className="text-sm text-gray-700">
                            Enabled
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={streamingCameras.has(camera.id)}
                            onChange={() => handleToggleStreaming(camera)}
                            id={`stream-${camera.id}`}
                            disabled={!camera.enabled}
                          />
                          <label htmlFor={`stream-${camera.id}`} className="text-sm text-gray-700">
                            Stream
                          </label>
                        </div>
                      </div>
                      {/* Only show video preview if enabled and streaming */}
                      {camera.enabled && streamingCameras.has(camera.id) && (
                        <div className="mt-2">
                          <img
                            src={`http://localhost:8000${camera.url}`}
                            className="w-full rounded border"
                            style={{ maxHeight: 180 }}
                            alt={`${camera.name} preview`}
                            onError={(e) => {
                              console.error('Image error for camera:', camera.id, e);
                              e.currentTarget.style.display = 'none';
                            }}
                            onLoad={() => console.log('Image loaded for camera:', camera.id)}
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Camera stream
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 