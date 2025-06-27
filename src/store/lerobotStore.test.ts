import { act } from 'react-dom/test-utils';
import { useLeRobotStore } from './lerobotStore';

describe('LeRobot Zustand Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useLeRobotStore.setState(useLeRobotStore.getInitialState?.() || {});
    });
  });

  it('should update armConfig', () => {
    useLeRobotStore.getState().setArmConfig({ leaderPort: '/dev/ttyUSB2' });
    expect(useLeRobotStore.getState().armConfig.leaderPort).toBe('/dev/ttyUSB2');
  });

  it('should add, set, and remove cameras', () => {
    const camera = { id: '1', name: 'Cam', url: '', enabled: true };
    useLeRobotStore.getState().setCameras([camera]);
    expect(useLeRobotStore.getState().cameras).toHaveLength(1);
    useLeRobotStore.getState().toggleCamera('1');
    expect(useLeRobotStore.getState().cameras[0].enabled).toBe(false);
  });

  it('should add, set, and remove datasets', () => {
    const dataset = { id: '1', name: 'DS', path: '', size: 1, createdAt: '', duration: 1, frameCount: 1 };
    useLeRobotStore.getState().addDataset(dataset);
    expect(useLeRobotStore.getState().datasets).toHaveLength(1);
    useLeRobotStore.getState().removeDataset('1');
    expect(useLeRobotStore.getState().datasets).toHaveLength(0);
  });

  it('should update trainingConfig', () => {
    useLeRobotStore.getState().setTrainingConfig({ epochs: 10 });
    expect(useLeRobotStore.getState().trainingConfig.epochs).toBe(10);
  });

  it('should update isTraining', () => {
    useLeRobotStore.getState().setTraining(true);
    expect(useLeRobotStore.getState().isTraining).toBe(true);
  });

  it('should update isConnected', () => {
    useLeRobotStore.getState().setConnected(true);
    expect(useLeRobotStore.getState().isConnected).toBe(true);
  });

  it('should update currentSession', () => {
    useLeRobotStore.getState().setSessionState({ isRecording: true });
    expect(useLeRobotStore.getState().currentSession.isRecording).toBe(true);
  });
}); 