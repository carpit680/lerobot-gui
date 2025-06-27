import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Link, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  CogIcon,
  WrenchScrewdriverIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  ChartBarIcon,
  PlayIcon,
  AcademicCapIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { useLeRobotStore } from '../store/lerobotStore'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Arm Configuration', href: '/arm-configuration', icon: CogIcon },
  { name: 'Calibration', href: '/calibration', icon: WrenchScrewdriverIcon },
  { name: 'Teleoperation', href: '/teleoperation', icon: VideoCameraIcon },
  { name: 'Dataset Recording', href: '/dataset-recording', icon: DocumentTextIcon },
  { name: 'Dataset Visualization', href: '/dataset-visualization', icon: ChartBarIcon },
  { name: 'Dataset Replay', href: '/dataset-replay', icon: PlayIcon },
  { name: 'Model Training', href: '/model-training', icon: AcademicCapIcon },
]

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}

export default function Sidebar({ open, setOpen, isCollapsed, setIsCollapsed }: SidebarProps) {
  const location = useLocation()
  const { currentSession } = useLeRobotStore()

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
                  <div className="flex h-16 shrink-0 items-center">
                    <a 
                      href="https://openbot.co.in" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-xl font-bold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer font-heading"
                    >
                      <img src="/logo_white.png" alt="OpenBot Logo" className="h-8 w-8" />
                      OpenBot
                    </a>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                to={item.href}
                                className={`
                                  group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                                  ${location.pathname === item.href
                                    ? 'bg-primary-50 text-primary-600'
                                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                                  }
                                `}
                                onClick={() => setOpen(false)}
                              >
                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'lg:w-16' : 'lg:w-72'
      }`}>
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center justify-between">
            {!isCollapsed && (
              <a 
                href="https://openbot.co.in" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-xl font-bold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer font-heading"
              >
                <img src="/logo_white.png" alt="OpenBot Logo" className="h-8 w-8" />
                OpenBot
              </a>
            )}
            <button
              onClick={toggleCollapse}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
              )}
            </button>
          </div>
          
          {/* Status Indicators */}
          {!isCollapsed && (
            <div className="space-y-3">
              {currentSession.isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm text-red-600">Recording</span>
                </div>
              )}
              
              {currentSession.isReplaying && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-sm text-blue-600">Replaying</span>
                </div>
              )}
              
              {currentSession.isTeleoperating && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-green-600">Teleoperating</span>
                </div>
              )}
            </div>
          )}
          
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={`
                          group flex items-center rounded-md p-2 text-sm leading-6 font-semibold transition-all duration-200
                          ${isCollapsed ? 'justify-center' : 'gap-x-3'}
                          ${location.pathname === item.href
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                          }
                        `}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        {!isCollapsed && item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  )
} 