import { useState, useRef, useEffect } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CommandLineIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline'

// Extend Window interface for global variable
declare global {
  interface Window {
    calibrationContinueResolve?: () => void
    calibrationProcess?: any
  }
}

interface CalibrationStep {
  id: string
  name: string
  description: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
}

interface RobotType {
  id: string
  name: string
  description: string
  calibrationSteps: CalibrationStep[]
}

// Backend API configuration
const BACKEND_URL = 'http://localhost:8000'

export default function Calibration() {
  const { armConfig } = useLeRobotStore()
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedArm, setSelectedArm] = useState<'leader' | 'follower'>('leader')
  const [selectedRobot, setSelectedRobot] = useState<string>('so100')
  const [calibrationOutput, setCalibrationOutput] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [waitingForUser, setWaitingForUser] = useState(false)
  const [robotId, setRobotId] = useState<string>('')
  const [sessionId, setSessionId] = useState<string>('')
  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)
  const [isSendingInput, setIsSendingInput] = useState(false)
  
  // LeRobot supported robots and their calibration steps
  const robotTypes: RobotType[] = [
    {
      id: 'so100',
      name: 'SO-100',
      description: '5-DOF robotic arm',
      calibrationSteps: [
        {
          id: 'connection',
          name: 'Connect to Robot',
          description: 'Establish connection to the robot arm',
          status: 'pending'
        },
        {
          id: 'calibration',
          name: 'Run Calibration',
          description: 'Execute the calibration process using LeRobot API',
          status: 'pending'
        },
        {
          id: 'completion',
          name: 'Calibration Complete',
          description: 'Calibration files saved and robot disconnected',
          status: 'pending'
        }
      ]
    },
    {
      id: 'giraffe',
      name: 'Giraffe v1.1',
      description: '6-DOF robotic arm',
      calibrationSteps: [
        {
          id: 'connection',
          name: 'Connect to Robot',
          description: 'Establish connection to the robot arm',
          status: 'pending'
        },
        {
          id: 'calibration',
          name: 'Run Calibration',
          description: 'Execute the calibration process using LeRobot API',
          status: 'pending'
        },
        {
          id: 'completion',
          name: 'Calibration Complete',
          description: 'Calibration files saved and robot disconnected',
          status: 'pending'
        }
      ]
    }
  ]

  const selectedRobotType = robotTypes.find(robot => robot.id === selectedRobot)
  const currentPort = selectedArm === 'leader' ? armConfig.leaderPort : armConfig.followerPort
  const robotType = selectedArm === 'leader' ? `${selectedRobot}_leader` : `${selectedRobot}_follower`

  // Check backend connection on component mount
  useEffect(() => {
    checkBackendConnection()
    
    // Set up periodic connection check every 5 seconds
    const connectionInterval = setInterval(checkBackendConnection, 5000)
    
    // Cleanup interval on unmount
    return () => clearInterval(connectionInterval)
  }, [])

  // Debug: Log when backendConnected state changes
  useEffect(() => {
    console.log('Backend connected state changed to:', backendConnected)
  }, [backendConnected])

  const checkBackendConnection = async () => {
    try {
      console.log('Checking backend connection...')
      const response = await fetch(`${BACKEND_URL}/health`)
      console.log('Backend response status:', response.status)
      if (response.ok) {
        console.log('Backend connection successful')
        setBackendConnected(true)
      } else {
        console.log('Backend connection failed with status:', response.status)
        setBackendConnected(false)
      }
    } catch (error) {
      console.error('Backend connection failed:', error)
      setBackendConnected(false)
    }
  }

  const startCalibration = async () => {
    if (!currentPort) {
      toast.error(`Please configure ${selectedArm} arm port in Arm Configuration`)
      return
    }

    if (!selectedRobotType) {
      toast.error('Please select a robot type')
      return
    }

    if (!robotId.trim()) {
      toast.error('Please provide a unique robot ID')
      return
    }

    if (backendConnected !== true) {
      toast.error('Backend is not connected. Please start the Python backend server.')
      return
    }

    setIsCalibrating(true)
    setCurrentStep(0)
    setCalibrationOutput('')

    // Reset all steps to pending
    selectedRobotType.calibrationSteps.forEach(step => step.status = 'pending')

    try {
      // Start calibration via backend
      const response = await fetch(`${BACKEND_URL}/calibrate/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arm_type: selectedArm,
          robot_type: robotType,
          port: currentPort,
          robot_id: robotId
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to start calibration: ${response.statusText}`)
      }

      const result = await response.json()
      setSessionId(result.session_id)
      setCalibrationOutput(`Calibration started with session ID: ${result.session_id}\nCommand: python -m lerobot.calibrate --${selectedArm === 'leader' ? 'teleop' : 'robot'}.type=${robotType} --${selectedArm === 'leader' ? 'teleop' : 'robot'}.port=${currentPort} --${selectedArm === 'leader' ? 'teleop' : 'robot'}.id=${robotId}`)

      // Start WebSocket connection for real-time output
      startWebSocketConnection(result.session_id)

      // Start monitoring the calibration process
      monitorCalibrationProcess(result.session_id)

    } catch (error) {
      console.error('Calibration start failed:', error)
      toast.error(`Failed to start calibration: ${error}`)
      setIsCalibrating(false)
    }
  }

  const startWebSocketConnection = (sessionId: string) => {
    console.log('Starting WebSocket connection for session:', sessionId)
    const wsUrl = `ws://localhost:8000/ws/calibration/${sessionId}`
    console.log('WebSocket URL:', wsUrl)
    
    const ws = new WebSocket(wsUrl)
    
    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      console.error('WebSocket connection timeout after 5 seconds')
      console.log('WebSocket ready state:', ws.readyState)
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }, 5000)
    
    ws.onopen = () => {
      console.log('WebSocket connected for calibration')
      clearTimeout(connectionTimeout) // Clear timeout when connection is successful
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'output') {
        // Clean up the output for better display
        let cleanOutput = data.data
        // Remove excessive whitespace and normalize line endings
        cleanOutput = cleanOutput.replace(/\r/g, '').trim()
        
        console.log('Received calibration output:', cleanOutput)
        
        setCalibrationOutput(cleanOutput)
        
        // Check if output indicates waiting for user input - more precise detection
        const output_lower = cleanOutput.toLowerCase()
        
        // Only detect waiting on specific prompts, not on every output
        if (output_lower.includes('press enter....') || 
            output_lower.includes('press enter to stop') ||
            output_lower.includes('press enter to continue') ||
            output_lower.includes('press enter') ||
            (output_lower.includes('move test') && output_lower.includes('middle of its range')) ||
            (output_lower.includes('move all joints') && output_lower.includes('entire ranges'))) {
          console.log('Calibration waiting for user input:', cleanOutput)
          setWaitingForUser(true)
        } else {
          console.log('No waiting detected in output:', cleanOutput)
        }
        
        // Update step status based on output content
        if (cleanOutput.includes('Calibration started for')) {
          if (selectedRobotType && selectedRobotType.calibrationSteps.length > 0) {
            selectedRobotType.calibrationSteps[0].status = 'in-progress' // Connection step
            setCurrentStep(0)
          }
        } else if (cleanOutput.includes('Move test') && cleanOutput.includes('middle of its range')) {
          if (selectedRobotType && selectedRobotType.calibrationSteps.length > 1) {
            selectedRobotType.calibrationSteps[0].status = 'completed' // Connection completed
            selectedRobotType.calibrationSteps[1].status = 'in-progress' // First calibration step
            setCurrentStep(1)
          }
        } else if (cleanOutput.includes('Move all joints') && cleanOutput.includes('entire ranges')) {
          if (selectedRobotType && selectedRobotType.calibrationSteps.length > 2) {
            // Only advance to step 2 if step 1 was completed
            if (selectedRobotType.calibrationSteps[1].status === 'completed') {
              selectedRobotType.calibrationSteps[2].status = 'in-progress' // Second calibration step
              setCurrentStep(2)
            }
          }
        } else if (cleanOutput.includes('Calibration completed successfully') || 
                   cleanOutput.includes('Process finished') ||
                   cleanOutput.includes('Calibration completed!') ||
                   cleanOutput.includes('exit code 0') ||
                   cleanOutput.includes('calibration files saved')) {
          if (selectedRobotType) {
            selectedRobotType.calibrationSteps.forEach(step => {
              if (step.status === 'pending' || step.status === 'in-progress') {
                step.status = 'completed'
              }
            })
            setCurrentStep(selectedRobotType.calibrationSteps.length - 1)
            // Reset waiting state when calibration completes
            setWaitingForUser(false)
          }
        }
      } else if (data.type === 'status') {
        if (data.data.status === 'finished') {
          // Calibration completed
          setIsCalibrating(false)
          setWaitingForUser(false)
          if (currentStep < selectedRobotType!.calibrationSteps.length) {
            selectedRobotType!.calibrationSteps.forEach(step => {
              if (step.status === 'pending') step.status = 'completed'
            })
          }
          toast.success('Calibration completed successfully!')
          
          // Check for calibration files
          checkCalibrationFiles()
        }
      } else if (data.type === 'error') {
        console.error('WebSocket error:', data.data)
        toast.error(`Calibration error: ${data.data}`)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      clearTimeout(connectionTimeout)
    }

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, 'Reason:', event.reason)
      clearTimeout(connectionTimeout)
    }

    setWebsocket(ws)
  }

  const monitorCalibrationProcess = async (sessionId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/calibrate/status/${sessionId}`)
        if (response.ok) {
          const status = await response.json()
          
          // Check if waiting for input
          const isWaiting = status.is_waiting_for_input || false
          setWaitingForUser(isWaiting)
          
          if (!status.is_running && isCalibrating) {
            setIsCalibrating(false)
            setWaitingForUser(false)
            toast.success('Calibration completed!')
            checkCalibrationFiles()
          }
        }
      } catch (error) {
        console.error('Status check failed:', error)
      }
    }

    // Check status every 2 seconds
    const interval = setInterval(checkStatus, 2000)
    
    // Clean up interval when component unmounts or calibration stops
    return () => clearInterval(interval)
  }

  const handleContinue = async () => {
    if (!sessionId || isSendingInput) {
      return // Prevent multiple clicks
    }

    setIsSendingInput(true)
    
    try {
      const response = await fetch(`${BACKEND_URL}/calibrate/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          input_data: '\n'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to send input: ${response.statusText}`)
      }

      const result = await response.json()
      if (result.success) {
        setWaitingForUser(false)
        setCalibrationOutput('[INFO] Enter key sent to calibration process')
        
        // Mark current step as completed when user clicks Continue
        if (selectedRobotType && selectedRobotType.calibrationSteps[currentStep]) {
          selectedRobotType.calibrationSteps[currentStep].status = 'completed'
        }
        
        // Add a small delay to prevent rapid clicking
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        toast.error('Failed to send input to calibration process')
      }
    } catch (error) {
      console.error('Send input failed:', error)
      toast.error(`Failed to send input: ${error}`)
    } finally {
      setIsSendingInput(false)
    }
  }

  const checkCalibrationFiles = async (retryCount = 0) => {
    try {
      const response = await fetch(`${BACKEND_URL}/check-calibration-files/${robotId}?arm_type=${selectedArm}`)
      if (response.ok) {
        const result = await response.json()
        console.log('Calibration files check result:', result)
        if (result.file_count > 0) {
          const fileList = result.files.map((file: any) => `  - ${file.name} (${file.path})`).join('\n')
          setCalibrationOutput(`[SUCCESS] Calibration files saved:\n${fileList}`)
        } else {
          if (retryCount < 3) {
            // Retry after a delay if no files found
            console.log(`No files found, retrying in 2 seconds... (attempt ${retryCount + 1}/3)`)
            setTimeout(() => checkCalibrationFiles(retryCount + 1), 2000)
            setCalibrationOutput(`[INFO] Checking for calibration files... (attempt ${retryCount + 1}/3)`)
          } else {
            setCalibrationOutput(`[WARNING] No calibration files found in cache directory: ${result.cache_directory}`)
          }
        }
      } else {
        console.error('Failed to check calibration files:', response.status, response.statusText)
        setCalibrationOutput(`[ERROR] Failed to check calibration files: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to check calibration files:', error)
      setCalibrationOutput(`[ERROR] Failed to check calibration files: ${error}`)
    }
  }

  const getStepIcon = (step: CalibrationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'in-progress':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  const getStepStatus = (step: CalibrationStep) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      case 'in-progress':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-heading">Arm Calibration</h1>
            <p className="mt-2 text-gray-600">
              Calibrate your robot arm using LeRobot framework
            </p>
          </div>

          {/* Backend Connection Status */}
          <div className="mb-8">
            <div className={`card ${backendConnected === true ? 'border-green-200 bg-green-50' : backendConnected === false ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {backendConnected === true ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  ) : backendConnected === false ? (
                    <XCircleIcon className="h-6 w-6 text-red-500" />
                  ) : (
                    <ArrowPathIcon className="h-6 w-6 text-gray-500 animate-spin" />
                  )}
                  <div>
                    <h3 className={`text-lg font-semibold ${backendConnected === true ? 'text-green-800' : backendConnected === false ? 'text-red-800' : 'text-gray-800'} font-heading`}>
                      Backend Connection
                    </h3>
                    <p className={backendConnected === true ? 'text-green-700' : backendConnected === false ? 'text-red-700' : 'text-gray-700'}>
                      {backendConnected === true 
                        ? 'Python backend is connected and ready'
                        : backendConnected === false
                        ? 'Python backend is not connected. Please start the backend server.'
                        : 'Checking backend connection...'
                      }
                    </p>
                    {backendConnected === false && (
                      <p className="text-sm text-red-600 mt-2">
                        Run: <code className="bg-red-100 px-1 rounded">cd backend && python main.py</code>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={checkBackendConnection}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Section */}
          <div className="mb-8">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 font-heading">Calibration Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Arm Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Arm
                  </label>
                  <select
                    value={selectedArm}
                    onChange={(e) => setSelectedArm(e.target.value as 'leader' | 'follower')}
                    className="input-field"
                    disabled={isCalibrating}
                  >
                    <option value="leader">Leader Arm</option>
                    <option value="follower">Follower Arm</option>
                  </select>
                  <p className="text-sm text-gray-600 mt-1">
                    Port: {currentPort || 'Not configured'}
                  </p>
                </div>

                {/* Robot Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Robot Type
                  </label>
                  <select
                    value={selectedRobot}
                    onChange={(e) => setSelectedRobot(e.target.value)}
                    className="input-field"
                    disabled={isCalibrating}
                  >
                    {robotTypes.map(robot => (
                      <option key={robot.id} value={robot.id}>
                        {robot.name} - {robot.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-600 mt-1">
                    Type: {robotType}
                  </p>
                </div>

                {/* Robot ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Robot ID
                  </label>
                  <input
                    type="text"
                    value={robotId}
                    onChange={(e) => setRobotId(e.target.value)}
                    placeholder="e.g., my_awesome_leader_arm"
                    className="input-field"
                    disabled={isCalibrating}
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Give your robot a unique name
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Port Configuration Check */}
          {!currentPort && (
            <div className="mb-8">
              <div className="card border-red-200 bg-red-50">
                <div className="flex items-center gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-800 font-heading">Port Not Configured</h3>
                    <p className="text-red-700">
                      Please configure the {selectedArm} arm port in the Arm Configuration page before starting calibration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Calibration Steps */}
            <div>
              {/* Steps List */}
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 font-heading">Calibration Steps</h2>
                  {isCalibrating && (
                    <div className="text-sm text-blue-600 font-medium">
                      Step {currentStep + 1} of {selectedRobotType?.calibrationSteps.length || 0}
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  {selectedRobotType?.calibrationSteps.map((step, index) => (
                    <div 
                      key={step.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        index === currentStep && step.status === 'in-progress'
                          ? 'border-blue-300 bg-blue-50 shadow-md'
                          : index === currentStep && step.status === 'waiting-user'
                          ? 'border-yellow-300 bg-yellow-50 shadow-md'
                          : step.status === 'completed'
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          {getStepIcon(step)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className={`font-medium ${index === currentStep ? 'text-blue-900' : 'text-gray-900'}`}>
                              {step.name}
                              {index === currentStep && step.status === 'in-progress' && (
                                <span className="ml-2 text-blue-600 text-sm font-normal">(Current)</span>
                              )}
                              {index === currentStep && step.status === 'waiting-user' && (
                                <span className="ml-2 text-yellow-600 text-sm font-normal">(Waiting for input)</span>
                              )}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStepStatus(step)}`}>
                              {step.status.replace('-', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                          
                          {/* Show user prompt if waiting */}
                          {step.status === 'waiting-user' && step.userPrompt && (
                            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm">
                              <strong>User Action Required:</strong> {step.userPrompt}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Control Buttons */}
              <div className="mt-6 flex gap-4">
                <button
                  onClick={startCalibration}
                  disabled={isCalibrating || !currentPort || !robotId.trim() || backendConnected === false}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCalibrating ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Calibrating...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start Calibration
                    </>
                  )}
                </button>

                {/* Continue Button - only show when waiting for user input */}
                {waitingForUser && (
                  <button
                    onClick={handleContinue}
                    disabled={isSendingInput}
                    className="btn-primary bg-yellow-600 hover:bg-yellow-700 border-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingInput ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-4 w-4 mr-2" />
                        Continue (Press Enter)
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Output Console */}
            <div>
              <div className="card h-full">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Real-time Output</h2>
                
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
                  {calibrationOutput || 'Ready to start calibration...\n'}
                  {waitingForUser && (
                    <div className="text-yellow-400 animate-pulse">
                      [WAITING] Click "Continue" button to proceed...
                    </div>
                  )}
                  {isCalibrating && !waitingForUser && <span className="animate-pulse">█</span>}
                </div>
                
                <div className="mt-4 text-sm text-gray-600">
                  <p>• Real-time output from the LeRobot calibration command</p>
                  <p>• Click "Continue" button to send Enter key when prompted</p>
                  <p>• Make sure LeRobot is installed: <code className="bg-gray-100 px-1 rounded">pip install lerobot</code></p>
                  <p>• Calibration files will be saved to:</p>
                  <ul className="list-disc list-inside ml-4 mt-2">
                    <li><strong>Leader Arm:</strong> <code className="bg-gray-100 px-1 rounded">~/.cache/huggingface/lerobot/calibration/teleoperators/&lt;robot_type&gt;/&lt;robot_id&gt;.json</code></li>
                    <li><strong>Follower Arm:</strong> <code className="bg-gray-100 px-1 rounded">~/.cache/huggingface/lerobot/calibration/robots/&lt;robot_type&gt;/&lt;robot_id&gt;.json</code></li>
                  </ul>
                  <p>• The calibration process has two interactive steps:</p>
                  <ul className="list-disc list-inside ml-4 mt-2">
                    <li>Move arm to zero position (click Continue when done)</li>
                    <li>Move joints through ranges (click Continue when done)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Calibration Tips */}
          <div className="mt-8">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Calibration Tips</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>• Ensure your robot arm is in a safe position before starting</p>
                <p>• Keep the workspace clear during calibration</p>
                <p>• Each step requires you to click "Continue" button to proceed</p>
                <p>• Verify arm connections are stable</p>
                <p>• Check that no external forces are applied to the arms</p>
                <p>• Make sure LeRobot is properly installed and configured</p>
                <p>• The calibration process will guide you through each step</p>
                <p>• Calibration files will be saved automatically to the cache directory</p>
                <p>• Refer to <a href="https://huggingface.co/docs/lerobot/index" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">LeRobot documentation</a> for detailed instructions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 