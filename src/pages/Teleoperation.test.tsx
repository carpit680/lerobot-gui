import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Teleoperation from './Teleoperation';
import * as store from '../store/lerobotStore';

jest.mock('../store/lerobotStore');
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ session_id: 'test-session' }) })) as jest.Mock;

const mockSetSessionState = jest.fn();

describe('Teleoperation Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store.useLeRobotStore as jest.Mock).mockReturnValue({
      armConfig: { leaderPort: '/dev/ttyUSB0', followerPort: '/dev/ttyUSB1' },
      cameras: [
        { id: 'cam1', name: 'Camera 1', url: '', enabled: true },
        { id: 'cam2', name: 'Camera 2', url: '', enabled: false },
      ],
      setSessionState: mockSetSessionState,
    });
  });

  it('renders Teleoperation page and configuration', () => {
    render(<Teleoperation />);
    expect(screen.getByText('Teleoperation')).toBeInTheDocument();
    expect(screen.getByText('Control your robot arms manually with real-time feedback')).toBeInTheDocument();
    expect(screen.getByText('Leader Arm')).toBeInTheDocument();
    expect(screen.getByText('Follower Arm')).toBeInTheDocument();
  });

  it('shows error if backend is not connected when starting teleoperation', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    render(<Teleoperation />);
    fireEvent.click(screen.getByText('Start Teleoperation'));
    await waitFor(() => {
      expect(screen.getByText(/Backend is not connected/i)).toBeInTheDocument();
    });
  });

  // Add more tests for camera selection, start/stop, and error handling as needed
}); 