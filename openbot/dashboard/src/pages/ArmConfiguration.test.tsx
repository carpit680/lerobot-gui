import React from 'react';
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ArmConfiguration from './ArmConfiguration';
import * as store from '../store/lerobotStore';

vi.mock('../store/lerobotStore');

// Mock fetch globally
const mockFetch = vi.fn();

describe('ArmConfiguration Page', () => {
  const mockStore = {
    armConfig: { 
      leaderPort: '/dev/ttyUSB0', 
      followerPort: '/dev/ttyUSB1',
      leaderConnected: false,
      followerConnected: false,
      leaderRobotType: '',
      followerRobotType: '',
      leaderRobotId: '',
      followerRobotId: '',
    },
    setArmConfig: vi.fn(),
    cameras: [],
    setCameras: vi.fn(),
    toggleCamera: vi.fn(),
    hfUser: '',
    setHfUser: vi.fn(),
    hfToken: '',
    setHfToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (store.useLeRobotStore as any).mockReturnValue(mockStore);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ports: ['/dev/ttyUSB0', '/dev/ttyUSB1'], cameras: [] })
    });
  });

  describe('Page Rendering', () => {
    it('renders the main page title', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('heading', { level: 1, name: 'Arm Configuration' })).toBeInTheDocument();
    });

    it('renders the page description', () => {
      render(<ArmConfiguration />);
      expect(screen.getByText('Configure the ports for your leader and follower robot arms')).toBeInTheDocument();
    });
  });

  describe('Hugging Face Credentials Section', () => {
    it('renders Hugging Face credentials section', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('heading', { level: 3, name: 'Hugging Face Credentials' })).toBeInTheDocument();
    });

    it('renders username input field', () => {
      render(<ArmConfiguration />);
      const usernameInput = screen.getByPlaceholderText('Enter your Hugging Face username');
      expect(usernameInput).toBeInTheDocument();
      expect(usernameInput).toHaveAttribute('type', 'text');
      expect(usernameInput).toHaveAttribute('autocomplete', 'username');
    });

    it('renders token input field', () => {
      render(<ArmConfiguration />);
      const tokenInput = screen.getByPlaceholderText('Enter your Hugging Face access token');
      expect(tokenInput).toBeInTheDocument();
      expect(tokenInput).toHaveAttribute('type', 'password');
      expect(tokenInput).toHaveAttribute('autocomplete', 'new-password');
    });

    it('shows token status message when no token is set', () => {
      render(<ArmConfiguration />);
      expect(screen.getByText('No token set. Required for Hugging Face API access.')).toBeInTheDocument();
    });

    it('shows token status message when token is set', () => {
      (store.useLeRobotStore as any).mockReturnValue({
        ...mockStore,
        hfToken: 'test-token'
      });
      render(<ArmConfiguration />);
      expect(screen.getByText('Token is set.')).toBeInTheDocument();
    });

    it('calls setHfUser when username is changed', () => {
      render(<ArmConfiguration />);
      const usernameInput = screen.getByPlaceholderText('Enter your Hugging Face username');
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      expect(mockStore.setHfUser).toHaveBeenCalledWith('testuser');
    });

    it('calls setHfToken when token is changed', () => {
      render(<ArmConfiguration />);
      const tokenInput = screen.getByPlaceholderText('Enter your Hugging Face access token');
      fireEvent.change(tokenInput, { target: { value: 'test-token' } });
      expect(mockStore.setHfToken).toHaveBeenCalledWith('test-token');
    });

    it('fetches environment variables from backend on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hf_user: 'envuser', hf_token: 'envtoken' })
      });

      render(<ArmConfiguration />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/env/huggingface');
      });
    });

    it('shows environment loaded indicator when credentials are loaded from env', async () => {
      (store.useLeRobotStore as any).mockReturnValue({
        ...mockStore,
        hfUser: 'envuser',
        hfToken: 'envtoken'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hf_user: 'envuser', hf_token: 'envtoken' })
      });

      render(<ArmConfiguration />);

      await waitFor(() => {
        expect(screen.getByText('✓ Loaded from system environment variables')).toBeInTheDocument();
      });
    });
  });

  describe('Arm Configuration Section', () => {
    it('renders arm configuration section', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('heading', { level: 3, name: 'Arm Configuration' })).toBeInTheDocument();
    });

    it('renders scan ports button', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('button', { name: 'Scan for Ports' })).toBeInTheDocument();
    });

    it('renders leader arm section', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('heading', { level: 2, name: 'Leader Arm' })).toBeInTheDocument();
      expect(screen.getByText('Primary control arm')).toBeInTheDocument();
    });

    it('renders follower arm section', () => {
      render(<ArmConfiguration />);
      const followerArmHeadings = screen.getAllByText('Follower Arm');
      expect(followerArmHeadings.length).toBeGreaterThan(0);
      expect(screen.getByText('Secondary controlled arm')).toBeInTheDocument();
    });

    it('renders robot type dropdowns for both arms', () => {
      render(<ArmConfiguration />);
      const robotTypeDropdowns = screen.getAllByText(/Select robot type/);
      expect(robotTypeDropdowns).toHaveLength(2);
    });

    it('renders robot ID input fields for both arms', () => {
      render(<ArmConfiguration />);
      const robotIdInputs = screen.getAllByPlaceholderText(/Enter robot ID/);
      expect(robotIdInputs).toHaveLength(2);
    });

    it('calls setArmConfig when robot type is changed', () => {
      render(<ArmConfiguration />);
      const robotTypeSelects = screen.getAllByRole('combobox');
      const leaderRobotTypeSelect = robotTypeSelects[1]; // First combobox is port, second is robot type
      fireEvent.change(leaderRobotTypeSelect, { target: { value: 'so100_leader' } });
      expect(mockStore.setArmConfig).toHaveBeenCalledWith({ leaderRobotType: 'so100_leader' });
    });

    it('calls setArmConfig when robot ID is changed', async () => {
      render(<ArmConfiguration />);
      const robotIdInputs = screen.getAllByPlaceholderText(/Enter robot ID/);
      fireEvent.change(robotIdInputs[0], { target: { value: 'leader_001' } });
      
      // Wait for the debounced save (1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(mockStore.setArmConfig).toHaveBeenCalledWith({ leaderRobotId: 'leader_001' });
    });

    it('has correct robot type options', () => {
      render(<ArmConfiguration />);
      const robotTypeSelects = screen.getAllByRole('combobox');
      const leaderRobotTypeSelect = robotTypeSelects[1]; // First combobox is port, second is robot type
      
      const options = Array.from(leaderRobotTypeSelect.querySelectorAll('option'));
      const optionValues = options.map(option => option.value);
      
      expect(optionValues).toContain('so100_leader');
      expect(optionValues).toContain('giraffe_leader');
    });

    it('calls scanUsbPorts when scan button is clicked', async () => {
      render(<ArmConfiguration />);
      const scanButton = screen.getByRole('button', { name: 'Scan for Ports' });
      
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/detect-ports');
      });
    });

    it('shows scanning state when scan button is clicked', async () => {
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<ArmConfiguration />);
      const scanButton = screen.getByRole('button', { name: 'Scan for Ports' });
      
      fireEvent.click(scanButton);
      
      expect(screen.getByRole('button', { name: 'Scanning...' })).toBeInTheDocument();
    });
  });

  describe('Camera Configuration Section', () => {
    it('renders camera configuration section', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('heading', { level: 3, name: 'Camera Configuration' })).toBeInTheDocument();
    });

    it('renders scan cameras button', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('button', { name: 'Scan Cameras' })).toBeInTheDocument();
    });

    it('shows no cameras message when no cameras are found', () => {
      render(<ArmConfiguration />);
      expect(screen.getByText('No cameras found. Click "Scan Cameras" to detect available cameras.')).toBeInTheDocument();
    });

    it('calls handleScanCameras when scan cameras button is clicked', async () => {
      render(<ArmConfiguration />);
      const scanButton = screen.getByRole('button', { name: 'Scan Cameras' });
      
      fireEvent.click(scanButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/scan-cameras');
      });
    });

    it('displays cameras when they are available', () => {
      const mockCameras = [
        { id: 'camera1', name: 'Front Camera', url: '/video/camera/0', enabled: true, index: 0 },
        { id: 'camera2', name: 'Side Camera', url: '/video/camera/1', enabled: false, index: 1 }
      ];

      (store.useLeRobotStore as any).mockReturnValue({
        ...mockStore,
        cameras: mockCameras
      });

      render(<ArmConfiguration />);
      
      expect(screen.getByText('Front Camera')).toBeInTheDocument();
      expect(screen.getByText('Side Camera')).toBeInTheDocument();
    });
  });

  describe('Motor Configuration Section', () => {
    it('renders motor configuration section', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('heading', { level: 3, name: 'Motor Configuration' })).toBeInTheDocument();
    });

    it('renders arm selection dropdown', () => {
      render(<ArmConfiguration />);
      const armSelect = screen.getByDisplayValue('Leader Arm');
      expect(armSelect).toBeInTheDocument();
    });

    it('renders robot type selection dropdown', () => {
      render(<ArmConfiguration />);
      const robotSelect = screen.getByDisplayValue('SO-100');
      expect(robotSelect).toBeInTheDocument();
    });

    it('renders run motor setup button', () => {
      render(<ArmConfiguration />);
      expect(screen.getByRole('button', { name: 'Run Motor Setup' })).toBeInTheDocument();
    });

    it('has correct arm options', () => {
      render(<ArmConfiguration />);
      const armSelect = screen.getByDisplayValue('Leader Arm');
      expect(armSelect).toHaveValue('leader');
      
      const options = Array.from(armSelect.querySelectorAll('option'));
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveValue('leader');
      expect(options[1]).toHaveValue('follower');
    });

    it('has correct robot type options', () => {
    render(<ArmConfiguration />);
      const robotSelect = screen.getByDisplayValue('SO-100');
      expect(robotSelect).toHaveValue('SO-100');
      
      const options = Array.from(robotSelect.querySelectorAll('option'));
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveValue('SO-100');
      expect(options[1]).toHaveValue('Giraffe');
    });
  });

  describe('Error Handling', () => {
    it('handles fetch error for environment variables gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      render(<ArmConfiguration />);
      
      // Should not throw error, just log warning
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/env/huggingface');
      });
    });

    it('handles fetch error for port detection gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      render(<ArmConfiguration />);
      const scanButton = screen.getByRole('button', { name: 'Scan for Ports' });
      
      fireEvent.click(scanButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/detect-ports');
      });
    });

    it('handles fetch error for camera scanning gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
    render(<ArmConfiguration />);
      const scanButton = screen.getByRole('button', { name: 'Scan Cameras' });
      
      fireEvent.click(scanButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/scan-cameras');
      });
    });
  });

  describe('Integration Tests', () => {
    it('loads environment variables and updates store', async () => {
      const mockSetHfUser = vi.fn();
      const mockSetHfToken = vi.fn();
      
      (store.useLeRobotStore as any).mockReturnValue({
        ...mockStore,
        setHfUser: mockSetHfUser,
        setHfToken: mockSetHfToken,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hf_user: 'testuser', hf_token: 'testtoken' })
      });

      render(<ArmConfiguration />);

      await waitFor(() => {
        expect(mockSetHfUser).toHaveBeenCalledWith('testuser');
        expect(mockSetHfToken).toHaveBeenCalledWith('testtoken');
      });
    });

    it('only updates store if values are not already set', async () => {
      const mockSetHfUser = vi.fn();
      const mockSetHfToken = vi.fn();
      
      (store.useLeRobotStore as any).mockReturnValue({
        ...mockStore,
        hfUser: 'existinguser',
        hfToken: 'existingtoken',
        setHfUser: mockSetHfUser,
        setHfToken: mockSetHfToken,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hf_user: 'newuser', hf_token: 'newtoken' })
      });

      render(<ArmConfiguration />);

      await waitFor(() => {
        expect(mockSetHfUser).not.toHaveBeenCalled();
        expect(mockSetHfToken).not.toHaveBeenCalled();
      });
    });
  });
}); 