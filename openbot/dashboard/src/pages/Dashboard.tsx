import { Link } from 'react-router-dom'
import { useLeRobotStore } from '../store/lerobotStore'
import {
  ChartBarIcon,
  PlayIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  CogIcon,
  WrenchScrewdriverIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const { 
    armConfig, 
    datasets, 
    cameras,
    currentSession,
    isTraining 
  } = useLeRobotStore()

  const quickActions = [
    {
      name: 'Configure Arms',
      description: 'Set up leader and follower arm ports',
      href: '/arm-configuration',
      icon: CogIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Calibrate Arms',
      description: 'Calibrate leader and follower arms',
      href: '/calibration',
      icon: WrenchScrewdriverIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Teleoperate',
      description: 'Control the robot arm manually',
      href: '/teleoperation',
      icon: VideoCameraIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Record Dataset',
      description: 'Record new training datasets',
      href: '/dataset-recording',
      icon: DocumentTextIcon,
      color: 'bg-red-500',
    },
    {
      name: 'Visualize Data',
      description: 'View and analyze datasets',
      href: '/dataset-visualization',
      icon: ChartBarIcon,
      color: 'bg-yellow-500',
    },
    {
      name: 'Replay Dataset',
      description: 'Replay recorded datasets',
      href: '/dataset-replay',
      icon: PlayIcon,
      color: 'bg-indigo-500',
    },
    {
      name: 'Train Model',
      description: 'Train models with datasets',
      href: '/model-training',
      icon: AcademicCapIcon,
      color: 'bg-pink-500',
    },
  ]

  const stats = [
    {
      name: 'Connected Arms',
      value: `${armConfig.leaderConnected ? 1 : 0}/${armConfig.followerConnected ? 1 : 0}`,
      description: 'Leader/Follower',
    },
    {
      name: 'Active Cameras',
      value: cameras.filter(c => c.enabled).length.toString(),
      description: 'of ' + cameras.length + ' cameras',
    },
    {
      name: 'Datasets',
      value: datasets.length.toString(),
      description: 'recorded datasets',
    },
    {
      name: 'System Status',
      value: currentSession.isRecording ? 'Recording' : 
                   currentSession.isReplaying ? 'Replaying' :
                   currentSession.isTeleoperating ? 'Teleoperating' :
                   isTraining ? 'Training' : 'Idle',
      description: '',
    },
  ]

  return (
    <div className="lg:pl-72">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">LeRobot Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Control and monitor your robot arms, record datasets, and train models
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.name} className="card">
                  <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stat.value}</dd>
                  <dd className="text-sm text-gray-600">{stat.description}</dd>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.name}
                  to={action.href}
                  className="card hover:shadow-md transition-shadow duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${action.color} text-white`}>
                      <action.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {action.name}
                      </h3>
                      <p className="text-sm text-gray-600">{action.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="card">
              <div className="space-y-4">
                {datasets.length > 0 ? (
                  datasets.slice(0, 5).map((dataset) => (
                    <div key={dataset.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-gray-900">{dataset.name}</p>
                        <p className="text-sm text-gray-600">
                          Created {new Date(dataset.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {Math.round(dataset.size / 1024 / 1024)} MB
                        </p>
                        <p className="text-sm text-gray-600">{dataset.frameCount} frames</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No datasets recorded yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 