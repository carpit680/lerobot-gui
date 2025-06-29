import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Configuration from './pages/Configuration'
import Calibration from './pages/Calibration'
import Teleoperation from './pages/Teleoperation'
import DatasetRecording from './pages/DatasetRecording'
import DatasetVisualization from './pages/DatasetVisualization'
import DatasetReplay from './pages/DatasetReplay'
import ModelTraining from './pages/ModelTraining'
import { LeRobotStore } from './store/lerobotStore'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <LeRobotStore>
      <Router>
        <div className="flex h-screen bg-gray-50">
          <Sidebar 
            open={sidebarOpen} 
            setOpen={setSidebarOpen}
            isCollapsed={sidebarCollapsed}
            setIsCollapsed={setSidebarCollapsed}
          />
          
          <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'
          }`}>
            <main className="flex-1 flex justify-center">
              <div className="w-full max-w-7xl">
                <Routes>
                  <Route path="/" element={<Navigate to="/configuration" replace />} />
                  <Route path="/configuration" element={<Configuration />} />
                  <Route path="/calibration" element={<Calibration />} />
                  <Route path="/teleoperation" element={<Teleoperation />} />
                  <Route path="/dataset-recording" element={<DatasetRecording />} />
                  <Route path="/dataset-visualization" element={<DatasetVisualization />} />
                  <Route path="/dataset-replay" element={<DatasetReplay />} />
                  <Route path="/model-training" element={<ModelTraining />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </Router>
    </LeRobotStore>
  )
}

export default App 