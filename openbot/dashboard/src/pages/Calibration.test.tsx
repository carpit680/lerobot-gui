import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Calibration from './Calibration';
import * as store from '../store/lerobotStore';

vi.mock('../store/lerobotStore');

const mockFetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ session_id: 'test-session' }) }));
vi.stubGlobal('fetch', mockFetch);

const mockSetCalibrationSteps = vi.fn();
const mockSetIsCalibrating = vi.fn();
const mockSetCurrentStep = vi.fn();
const mockSetCalibrationOutput = vi.fn();
const mockSetIsCancelled = vi.fn();
const mockSetSessionId = vi.fn();
const mockSetBackendConnected = vi.fn();
const mockSetWaitingForUser = vi.fn();
const mockSetWebsocket = vi.fn();

describe('Calibration Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (store.useLeRobotStore as any).mockReturnValue({
      armConfig: { 
        leaderPort: '/dev/ttyUSB0', 
        followerPort: '/dev/ttyUSB1',
        leaderRobotType: 'so100',
        followerRobotType: 'giraffe',
        leaderRobotId: 'leader_arm',
        followerRobotId: 'follower_arm'
      },
      setArmConfig: vi.fn()
    });
  });

  it('renders calibration steps and controls', () => {
    render(<Calibration />);
    expect(screen.getByText('Arm Calibration')).toBeInTheDocument();
    expect(screen.getByText('Calibrate your leader and follower robot arms for accurate control')).toBeInTheDocument();
    expect(screen.getByText('Backend Connection')).toBeInTheDocument();
  });

  it('renders arm selection dropdown', () => {
    render(<Calibration />);
    expect(screen.getByText('Select Arm to Calibrate')).toBeInTheDocument();
    expect(screen.getByText('Arm Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('leader')).toBeInTheDocument();
  });

  it('shows leader arm configuration when leader is selected', () => {
    render(<Calibration />);
    expect(screen.getByText('Leader Arm Configuration')).toBeInTheDocument();
    expect(screen.getByText('/dev/ttyUSB0')).toBeInTheDocument();
    expect(screen.getByText('so100')).toBeInTheDocument();
    expect(screen.getByText('leader_arm')).toBeInTheDocument();
  });

  it('shows follower arm configuration when follower is selected', async () => {
    render(<Calibration />);
    
    // Change selection to follower
    const select = screen.getByDisplayValue('leader');
    fireEvent.change(select, { target: { value: 'follower' } });
    
    await waitFor(() => {
      expect(screen.getByText('Follower Arm Configuration')).toBeInTheDocument();
      expect(screen.getByText('/dev/ttyUSB1')).toBeInTheDocument();
      expect(screen.getByText('giraffe')).toBeInTheDocument();
      expect(screen.getByText('follower_arm')).toBeInTheDocument();
    });
  });

  it('shows error if backend is not connected when starting calibration', async () => {
    mockFetch.mockResolvedValueOnce({ 
      ok: false, 
      json: () => Promise.resolve({ error: 'Backend not connected' }) 
    });
    render(<Calibration />);
    fireEvent.click(screen.getByText('Start Calibration'));
    await waitFor(() => {
      expect(screen.getByText(/Backend is not connected/i)).toBeInTheDocument();
    });
  });

  // Add more tests for step transitions, user prompts, and error handling as needed
}); 