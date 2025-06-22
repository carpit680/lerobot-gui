import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import ArmConfiguration from './pages/ArmConfiguration'
import Calibration from './pages/Calibration'
import Teleoperation from './pages/Teleoperation'
import DatasetRecording from './pages/DatasetRecording'
import DatasetVisualization from './pages/DatasetVisualization'
import DatasetReplay from './pages/DatasetReplay'
import ModelTraining from './pages/ModelTraining'
import { LeRobotStore } from './store/lerobotStore'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <LeRobotStore>
      <Router>
        <div className="flex h-screen bg-gray-50">
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/arm-configuration" element={<ArmConfiguration />} />
                <Route path="/calibration" element={<Calibration />} />
                <Route path="/teleoperation" element={<Teleoperation />} />
                <Route path="/dataset-recording" element={<DatasetRecording />} />
                <Route path="/dataset-visualization" element={<DatasetVisualization />} />
                <Route path="/dataset-replay" element={<DatasetReplay />} />
                <Route path="/model-training" element={<ModelTraining />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </LeRobotStore>
  )
}

export default App 