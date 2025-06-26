import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';
import * as store from '../store/lerobotStore';

describe('Sidebar', () => {
  const setOpen = jest.fn();
  const setIsCollapsed = jest.fn();

  beforeEach(() => {
    jest.spyOn(store, 'useLeRobotStore').mockReturnValue({
      currentSession: {
        isRecording: false,
        isReplaying: false,
        isTeleoperating: false,
      },
    });
  });

  it('renders all navigation links', () => {
    render(
      <MemoryRouter>
        <Sidebar open={true} setOpen={setOpen} isCollapsed={false} setIsCollapsed={setIsCollapsed} />
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Arm Configuration')).toBeInTheDocument();
    expect(screen.getByText('Calibration')).toBeInTheDocument();
    expect(screen.getByText('Teleoperation')).toBeInTheDocument();
    expect(screen.getByText('Dataset Recording')).toBeInTheDocument();
    expect(screen.getByText('Dataset Visualization')).toBeInTheDocument();
    expect(screen.getByText('Dataset Replay')).toBeInTheDocument();
    expect(screen.getByText('Model Training')).toBeInTheDocument();
  });

  it('calls setIsCollapsed when collapse button is clicked', () => {
    render(
      <MemoryRouter>
        <Sidebar open={true} setOpen={setOpen} isCollapsed={false} setIsCollapsed={setIsCollapsed} />
      </MemoryRouter>
    );
    const button = screen.getByTitle('Collapse sidebar');
    fireEvent.click(button);
    expect(setIsCollapsed).toHaveBeenCalled();
  });

  it('shows status indicators when session is active', () => {
    jest.spyOn(store, 'useLeRobotStore').mockReturnValue({
      currentSession: {
        isRecording: true,
        isReplaying: true,
        isTeleoperating: true,
      },
    });
    render(
      <MemoryRouter>
        <Sidebar open={true} setOpen={setOpen} isCollapsed={false} setIsCollapsed={setIsCollapsed} />
      </MemoryRouter>
    );
    expect(screen.getByText('Recording')).toBeInTheDocument();
    expect(screen.getByText('Replaying')).toBeInTheDocument();
    expect(screen.getByText('Teleoperating')).toBeInTheDocument();
  });
}); 