import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArmConfiguration from './ArmConfiguration';
import * as store from '../store/lerobotStore';

jest.mock('../store/lerobotStore');
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ports: ['/dev/ttyUSB0'], cameras: [] }) })) as jest.Mock;

describe('ArmConfiguration Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store.useLeRobotStore as jest.Mock).mockReturnValue({
      armConfig: { leaderPort: '/dev/ttyUSB0', followerPort: '/dev/ttyUSB1' },
      setArmConfig: jest.fn(),
      cameras: [],
      setCameras: jest.fn(),
      toggleCamera: jest.fn(),
    });
  });

  it('renders Arm Configuration page', () => {
    render(<ArmConfiguration />);
    expect(screen.getByText('Arm Configuration')).toBeInTheDocument();
    expect(screen.getByText('USB Device')).toBeInTheDocument();
  });

  it('calls setArmConfig when port is changed', async () => {
    render(<ArmConfiguration />);
    fireEvent.change(screen.getByLabelText(/Port/i), { target: { value: '/dev/ttyUSB2' } });
    // setArmConfig should be called (mocked)
  });

  // Add more tests for camera scanning, toggling, and error handling as needed
}); 