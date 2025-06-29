import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import Configuration from './ArmConfiguration'
import * as store from '../store/lerobotStore'
import { toast } from 'react-hot-toast'

// Mock dependencies
vi.mock('react-hot-toast')
vi.mock('../store/lerobotStore')

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
    setArmConfig: vi.fn(),
    cameras: [],
    setCameras: vi.fn(),
    toggleCamera: vi.fn(),
    hfUser: 'testuser',
    setHfUser: vi.fn(),
    hfToken: 'testtoken',
    setHfToken: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(store.useLeRobotStore as any).mockReturnValue(mockStore)
    
    // Mock fetch using window object instead of global
    ;(window as any).fetch = vi.fn()
  })

  it('renders Configuration page with title', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    const title = screen.getByRole('heading', { level: 1, name: 'Configuration' })
    expect(title).toBeDefined()
  })

  it('renders Hugging Face credentials section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    const credentialsHeading = screen.getByRole('heading', { level: 3, name: 'Hugging Face Credentials' })
    const usernameInput = screen.getByLabelText('Hugging Face Username')
    const tokenInput = screen.getByLabelText('Access Token')
    
    expect(credentialsHeading).toBeDefined()
    expect(usernameInput).toBeDefined()
    expect(tokenInput).toBeDefined()
  })

  it('renders robot configuration section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    const robotHeading = screen.getByRole('heading', { level: 3, name: 'Robot Configuration' })
    const leaderArm = screen.getByText('Leader Arm')
    const followerArm = screen.getByText('Follower Arm')
    
    expect(robotHeading).toBeDefined()
    expect(leaderArm).toBeDefined()
    expect(followerArm).toBeDefined()
  })

  it('renders camera configuration section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    const cameraHeading = screen.getByRole('heading', { level: 3, name: 'Camera Configuration' })
    const scanButton = screen.getByText('Scan Cameras')
    
    expect(cameraHeading).toBeDefined()
    expect(scanButton).toBeDefined()
  })

  it('renders motor configuration section', () => {
    render(
      <MemoryRouter>
        <Configuration />
      </MemoryRouter>
    )
    const motorHeading = screen.getByRole('heading', { level: 3, name: 'Motor Configuration' })
    const runButton = screen.getByText('Run Motor Setup')
    
    expect(motorHeading).toBeDefined()
    expect(runButton).toBeDefined()
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
    
    const indicator = screen.getByText('✓ Loaded from system environment variables')
    expect(indicator).toBeDefined()
  })

  it('handles port scanning', async () => {
    const mockFetch = (window as any).fetch as any
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
    const mockFetch = (window as any).fetch as any
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
      const robotHeading = screen.getByRole('heading', { level: 3, name: 'Robot Configuration' })
      expect(robotHeading).toBeDefined()
    })

    it('displays leader arm configuration', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const leaderArm = screen.getByText('Leader Arm')
      const primaryControl = screen.getByText('Primary control arm')
      
      expect(leaderArm).toBeDefined()
      expect(primaryControl).toBeDefined()
    })

    it('displays follower arm configuration', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const followerArm = screen.getByText('Follower Arm')
      const secondaryControl = screen.getByText('Secondary controlled arm')
      
      expect(followerArm).toBeDefined()
      expect(secondaryControl).toBeDefined()
    })
  })

  describe('Camera Configuration Section', () => {
    it('renders camera configuration section', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const cameraHeading = screen.getByRole('heading', { level: 3, name: 'Camera Configuration' })
      expect(cameraHeading).toBeDefined()
    })

    it('shows scan cameras button', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const scanButton = screen.getByText('Scan Cameras')
      expect(scanButton).toBeDefined()
    })

    it('shows no cameras message when no cameras are found', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const noCamerasMessage = screen.getByText('No cameras found. Click "Scan Cameras" to detect available cameras.')
      expect(noCamerasMessage).toBeDefined()
    })
  })

  describe('Motor Configuration Section', () => {
    it('renders motor configuration section', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const motorHeading = screen.getByRole('heading', { level: 3, name: 'Motor Configuration' })
      expect(motorHeading).toBeDefined()
    })

    it('shows arm selection dropdown', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const armDropdown = screen.getByLabelText('Arm')
      expect(armDropdown).toBeDefined()
    })

    it('shows robot type selection dropdown', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const robotTypeDropdown = screen.getByLabelText('Robot Type')
      expect(robotTypeDropdown).toBeDefined()
    })

    it('shows run motor setup button', () => {
      render(
        <MemoryRouter>
          <Configuration />
        </MemoryRouter>
      )
      const runButton = screen.getByText('Run Motor Setup')
      expect(runButton).toBeDefined()
    })
  })
}) 