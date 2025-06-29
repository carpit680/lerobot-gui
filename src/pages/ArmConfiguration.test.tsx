import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Configuration from './Configuration'
import * as store from '../store/lerobotStore'
import { toast } from 'react-hot-toast'

// Mock dependencies
jest.mock('react-hot-toast')
jest.mock('../store/lerobotStore')

const mockToast = toast as jest.Mocked<typeof toast>

describe('Configuration', () => {
  const mockStore = {
    armConfig: {
      leaderPort: '/dev/ttyUSB0',
      followerPort: '/dev/ttyUSB1',
      leaderConnected: false,
      followerConnected: false,
      leaderRobotType: 'so100_leader',
      followerRobotType: 'so100_follower',
      leaderRobotId: 'leader_001',
      followerRobotId: 'follower_001',
    },
    setArmConfig: jest.fn(),
    cameras: [],
    setCameras: jest.fn(),
    toggleCamera: jest.fn(),
    hfUser: 'testuser',
    setHfUser: jest.fn(),
    hfToken: 'testtoken',
    setHfToken: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(store.useLeRobotStore as jest.Mock).mockReturnValue(mockStore)
    
    // Mock fetch
    global.fetch = jest.fn()
  })

  it('renders Configuration page with title', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Configuration' })).toBeInTheDocument()
  })

  it('renders Hugging Face credentials section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Hugging Face Credentials' })).toBeInTheDocument()
    expect(screen.getByLabelText('Hugging Face Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Access Token')).toBeInTheDocument()
  })

  it('renders robot configuration section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Robot Configuration' })).toBeInTheDocument()
    expect(screen.getByText('Leader Arm')).toBeInTheDocument()
    expect(screen.getByText('Follower Arm')).toBeInTheDocument()
  })

  it('renders camera configuration section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Camera Configuration' })).toBeInTheDocument()
    expect(screen.getByText('Scan Cameras')).toBeInTheDocument()
  })

  it('renders motor configuration section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Motor Configuration' })).toBeInTheDocument()
    expect(screen.getByText('Run Motor Setup')).toBeInTheDocument()
  })

  it('handles Hugging Face username change', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    
    const usernameInput = screen.getByLabelText('Hugging Face Username')
    fireEvent.change(usernameInput, { target: { value: 'newuser' } })
    
    expect(mockStore.setHfUser).toHaveBeenCalledWith('newuser')
  })

  it('handles Hugging Face token change', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    
    const tokenInput = screen.getByLabelText('Access Token')
    fireEvent.change(tokenInput, { target: { value: 'newtoken' } })
    
    expect(mockStore.setHfToken).toHaveBeenCalledWith('newtoken')
  })

  it('shows environment loaded indicator when credentials are available', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    
    expect(screen.getByText('✓ Loaded from system environment variables')).toBeInTheDocument()
  })

  it('handles port scanning', async () => {
    const mockFetch = global.fetch as jest.Mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ports: ['/dev/ttyUSB0', '/dev/ttyUSB1'] })
    })

    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    
    const scanButton = screen.getByText('Scan for Ports')
    fireEvent.click(scanButton)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/detect-ports')
    })
  })

  it('handles camera scanning', async () => {
    const mockFetch = global.fetch as jest.Mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cameras: [{ name: 'Test Camera', width: 1920, height: 1080, fps: 30 }] })
    })

    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    
    const scanButton = screen.getByText('Scan Cameras')
    fireEvent.click(scanButton)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/scan-cameras')
    })
  })

  describe('Robot Configuration Section', () => {
    it('renders robot configuration section', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByRole('heading', { level: 3, name: 'Robot Configuration' })).toBeInTheDocument()
    })

    it('displays leader arm configuration', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByText('Leader Arm')).toBeInTheDocument()
      expect(screen.getByText('Primary control arm')).toBeInTheDocument()
    })

    it('displays follower arm configuration', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByText('Follower Arm')).toBeInTheDocument()
      expect(screen.getByText('Secondary controlled arm')).toBeInTheDocument()
    })
  })

  describe('Camera Configuration Section', () => {
    it('renders camera configuration section', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByRole('heading', { level: 3, name: 'Camera Configuration' })).toBeInTheDocument()
    })

    it('shows scan cameras button', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByText('Scan Cameras')).toBeInTheDocument()
    })

    it('shows no cameras message when no cameras are found', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByText('No cameras found. Click "Scan Cameras" to detect available cameras.')).toBeInTheDocument()
    })
  })

  describe('Motor Configuration Section', () => {
    it('renders motor configuration section', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByRole('heading', { level: 3, name: 'Motor Configuration' })).toBeInTheDocument()
    })

    it('shows arm selection dropdown', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByLabelText('Arm')).toBeInTheDocument()
    })

    it('shows robot type selection dropdown', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByLabelText('Robot Type')).toBeInTheDocument()
    })

    it('shows run motor setup button', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      expect(screen.getByText('Run Motor Setup')).toBeInTheDocument()
    })
  })
}) 