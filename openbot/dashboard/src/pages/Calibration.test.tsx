import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Calibration from './Calibration';
import * as store from '../store/lerobotStore';

jest.mock('../store/lerobotStore');
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ session_id: 'test-session' }) })) as jest.Mock;

const mockSetCalibrationSteps = jest.fn();
const mockSetIsCalibrating = jest.fn();
const mockSetCurrentStep = jest.fn();
const mockSetCalibrationOutput = jest.fn();
const mockSetIsCancelled = jest.fn();
const mockSetSessionId = jest.fn();
const mockSetBackendConnected = jest.fn();
const mockSetWaitingForUser = jest.fn();
const mockSetWebsocket = jest.fn();

describe('Calibration Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store.useLeRobotStore as jest.Mock).mockReturnValue({
      armConfig: { leaderPort: '/dev/ttyUSB0', followerPort: '/dev/ttyUSB1' },
    });
  });

  it('renders calibration steps and controls', () => {
    render(<Calibration />);
    expect(screen.getByText('Arm Calibration')).toBeInTheDocument();
    expect(screen.getByText('Calibrate your leader and follower robot arms for accurate control')).toBeInTheDocument();
    expect(screen.getByText('Backend Connection')).toBeInTheDocument();
  });

  it('shows error if backend is not connected when starting calibration', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    render(<Calibration />);
    fireEvent.click(screen.getByText('Start Calibration'));
    await waitFor(() => {
      expect(screen.getByText(/Backend is not connected/i)).toBeInTheDocument();
    });
  });

  // Add more tests for step transitions, user prompts, and error handling as needed
}); 