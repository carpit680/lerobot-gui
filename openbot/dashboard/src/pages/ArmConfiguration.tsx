import { useState, useEffect } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  CogIcon,
} from '@heroicons/react/24/outline'

interface UsbPort {
  path: string
  name: string
  connected: boolean
  lastSeen: Date
}

export default function ArmConfiguration() {
  const { armConfig, setArmConfig } = useLeRobotStore()
  const [usbPorts, setUsbPorts] = useState<UsbPort[]>([])
  const [isScanning, setIsScanning] = useState(false)

  // Scan for USB ports
  const scanUsbPorts = async () => {
    setIsScanning(true)
    try {
      // Scan for real USB devices
      const realPorts: UsbPort[] = []
      
      // Common USB serial device paths on Linux
      const possiblePaths = [
        '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2', '/dev/ttyUSB3',
        '/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyACM2', '/dev/ttyACM3',
        '/dev/ttyS0', '/dev/ttyS1', '/dev/ttyS2', '/dev/ttyS3'
      ]
      
      // Check which devices are actually connected
      for (const path of possiblePaths) {
        try {
          // REAL IMPLEMENTATION NOTES:
          // Since this runs in a browser, you have several options for real device detection:
          //
          // Option 1: Backend API
          // - Create a backend service (Node.js/Python) that can access /dev/tty*
          // - Use libraries like 'serialport' (Node.js) or 'pyserial' (Python)
          // - Make API calls from this frontend to get device list
          //
          // Option 2: Electron App
          // - Convert this to an Electron app to get Node.js access
          // - Use 'serialport' library directly in the main process
          //
          // Option 3: Web Serial API (Chrome/Edge only)
          // - Use navigator.serial.requestPort() for user-selected devices
          // - Limited to user interaction, not automatic scanning
          
          // For now, we'll simulate device detection
          // Replace this with actual implementation based on your setup
          const deviceExists = await checkDeviceExists(path)
          
          if (deviceExists) {
            realPorts.push({
              path,
              name: `USB Device (${path})`,
              connected: true,
              lastSeen: new Date()
            })
          }
        } catch (error) {
          // Device not accessible or doesn't exist
          console.log(`Device ${path} not accessible:`, error)
        }
      }

      // If no devices found, show empty state
      setUsbPorts(realPorts)

    } catch (error) {
      console.error('Error scanning USB ports:', error)
      toast.error('Failed to scan USB ports')
    } finally {
      setIsScanning(false)
    }
  }

  // Helper function to check if a device exists
  // REPLACE THIS WITH ACTUAL DEVICE DETECTION
  const checkDeviceExists = async (path: string): Promise<boolean> => {
    // REAL IMPLEMENTATION EXAMPLES:
    
    // Option 1: Backend API call
    // try {
    //   const response = await fetch('/api/usb/devices')
    //   const devices = await response.json()
    //   return devices.some((device: any) => device.path === path)
    // } catch (error) {
    //   console.error('Failed to check device via API:', error)
    //   return false
    // }
    
    // Option 2: Electron main process (if using Electron)
    // return window.electronAPI.checkDeviceExists(path)
    
    // Option 3: Web Serial API (limited to user interaction)
    // const ports = await navigator.serial.getPorts()
    // return ports.some(port => port.getInfo().usbProductId)
    
    // For now, simulate device detection
    // This is where you would implement real device checking
    const connectedDevices = ['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0']
    return connectedDevices.includes(path)
  }

  // Auto-refresh USB ports every second
  useEffect(() => {
    const interval = setInterval(scanUsbPorts, 1000)
    return () => clearInterval(interval)
  }, [])

  // Initial scan on component mount
  useEffect(() => {
    scanUsbPorts()
  }, [])

  const handlePortChange = (armType: 'leader' | 'follower', port: string) => {
    setArmConfig({
      [`${armType}Port`]: port
    })
    toast.success(`${armType.charAt(0).toUpperCase() + armType.slice(1)} arm port set to ${port}`)
  }

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Arm Configuration</h1>
            <p className="mt-2 text-gray-600">
              Configure the ports for your leader and follower robot arms
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CogIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Leader Arm</h2>
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
                  <h2 className="text-xl font-semibold text-gray-900">Follower Arm</h2>
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
        </div>
      </div>
    </div>
  )
} 