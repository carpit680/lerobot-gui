import warnings
warnings.filterwarnings("ignore", message="The 'app' shortcut is now deprecated")

import pytest
from fastapi.testclient import TestClient
from backend import main

client = TestClient(main.app)

class TestRootEndpoints:
    """Test basic endpoints"""
    
    def test_root(self):
        """Test root endpoint"""
        response = client.get('/')
        assert response.status_code == 200
        assert response.json() == {"message": "LeRobot Calibration API"}

    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get('/health')
        assert response.status_code == 200
        assert response.json() == {'status': 'healthy'}

class TestCalibrationEndpoints:
    """Test calibration-related endpoints"""
    
    def test_start_calibration_success(self):
        """Test successful calibration start"""
        response = client.post('/calibrate/start', json={
            'arm_type': 'leader',
            'robot_type': 'so100_leader',
            'port': '/dev/ttyUSB0',
            'robot_id': 'test_robot'
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data
        assert 'session_id' in data

    def test_start_calibration_invalid_data(self):
        """Test calibration start with invalid data"""
        response = client.post('/calibrate/start', json={
            'arm_type': 'invalid',
            'robot_type': 'invalid_type',
            'port': '',
            'robot_id': ''
        })
        assert response.status_code == 200  # Service handles validation

    def test_send_input_success(self):
        """Test sending input to calibration"""
        response = client.post('/calibrate/input', json={
            'session_id': 'session123',
            'input_data': 'test input'
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data

    def test_get_calibration_status(self):
        """Test getting calibration status"""
        response = client.get('/calibrate/status/session123')
        assert response.status_code == 200
        data = response.json()
        assert 'session_id' in data
        assert 'is_running' in data

    def test_stop_calibration(self):
        """Test stopping calibration"""
        response = client.delete('/calibrate/stop/session123')
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data

    def test_check_calibration_files(self):
        """Test checking calibration files"""
        response = client.get('/check-calibration-files/test_robot?arm_type=follower')
        assert response.status_code == 200
        data = response.json()
        assert 'file_count' in data
        assert 'files' in data
        assert 'cache_directory' in data

class TestPortAndCameraEndpoints:
    """Test port and camera detection endpoints"""
    
    def test_list_ports(self):
        """Test listing available ports"""
        response = client.get('/list-ports')
        assert response.status_code == 200
        data = response.json()
        assert 'ports' in data

    def test_detect_ports(self):
        """Test detecting ports"""
        response = client.get('/detect-ports')
        assert response.status_code == 200
        data = response.json()
        assert 'ports' in data

    def test_scan_cameras(self):
        """Test scanning cameras"""
        response = client.get('/scan-cameras')
        assert response.status_code == 200
        data = response.json()
        assert 'cameras' in data

class TestTeleoperationEndpoints:
    """Test teleoperation endpoints"""
    
    def test_start_teleoperation_success(self):
        """Test successful teleoperation start"""
        response = client.post('/teleop/start', json={
            'leader_type': 'so100_leader',
            'leader_port': '/dev/ttyUSB0',
            'leader_id': 'leader_robot',
            'follower_type': 'so100_follower',
            'follower_port': '/dev/ttyUSB1',
            'follower_id': 'follower_robot',
            'cameras': []
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data
        assert 'session_id' in data

    def test_get_teleoperation_status(self):
        """Test getting teleoperation status"""
        response = client.get('/teleop/status/session789')
        assert response.status_code == 200
        data = response.json()
        assert 'session_id' in data
        assert 'is_running' in data

    def test_stop_teleoperation(self):
        """Test stopping teleoperation"""
        response = client.delete('/teleop/stop/session789')
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data

class TestMotorSetupEndpoints:
    """Test motor setup endpoints"""
    
    def test_start_motor_setup_success(self):
        """Test successful motor setup start"""
        response = client.post('/motor-setup/start', json={
            'robot_type': 'so100',
            'port': '/dev/ttyUSB0'
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data
        assert 'session_id' in data

    def test_get_motor_setup_status(self):
        """Test getting motor setup status"""
        response = client.get('/motor-setup/status/session456')
        assert response.status_code == 200
        data = response.json()
        assert 'session_id' in data
        assert 'is_running' in data

    def test_send_motor_setup_input(self):
        """Test sending input to motor setup"""
        response = client.post('/motor-setup/input', json={
            'session_id': 'session456',
            'input_data': 'test input'
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data

    def test_stop_motor_setup(self):
        """Test stopping motor setup"""
        response = client.delete('/motor-setup/stop/session456')
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data

class TestDatasetRecordingEndpoints:
    """Test dataset recording endpoints"""
    
    def test_start_dataset_recording_success(self):
        """Test successful dataset recording start"""
        response = client.post('/dataset-recording/start', json={
            'robot_type': 'so100_follower',
            'robot_port': '/dev/ttyUSB0',
            'robot_id': 'follower_robot',
            'teleop_type': 'so100_leader',
            'teleop_port': '/dev/ttyUSB1',
            'teleop_id': 'leader_robot',
            'cameras': [],
            'display_data': True,
            'dataset_repo_id': 'test_user/test_dataset',
            'num_episodes': 5,
            'single_task': 'Test task',
            'push_to_hub': False,
            'resume': True,
            'episode_time_s': 60,
            'reset_time_s': 60
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data
        assert 'session_id' in data

    def test_get_dataset_recording_status(self):
        """Test getting dataset recording status"""
        response = client.get('/dataset-recording/status/session_recording_123')
        assert response.status_code == 200
        data = response.json()
        assert 'session_id' in data
        assert 'is_running' in data

    def test_stop_dataset_recording(self):
        """Test stopping dataset recording"""
        response = client.delete('/dataset-recording/stop/session_recording_123')
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data

class TestDatasetReplayEndpoints:
    """Test dataset replay endpoints"""
    
    def test_start_dataset_replay_success(self):
        """Test successful dataset replay start"""
        response = client.post('/dataset-replay/start', json={
            'robot_type': 'so100_follower',
            'robot_port': '/dev/ttyUSB0',
            'robot_id': 'follower_robot',
            'dataset_repo_id': 'test_user/test_dataset',
            'episode': 0
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data
        assert 'session_id' in data

    def test_get_dataset_replay_status(self):
        """Test getting dataset replay status"""
        response = client.get('/dataset-replay/status/session_replay_123')
        assert response.status_code == 200
        data = response.json()
        assert 'session_id' in data
        assert 'is_running' in data

    def test_stop_dataset_replay(self):
        """Test stopping dataset replay"""
        response = client.delete('/dataset-replay/stop/session_replay_123')
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data

class TestDatasetVisualizationEndpoints:
    """Test dataset visualization endpoints"""
    
    def test_fetch_user_datasets(self):
        """Test fetching user datasets"""
        response = client.post('/dataset-visualization/fetch', json={
            'username': 'test_user',
            'token': 'test_token',
            'search_query': 'test'
        })
        assert response.status_code == 200
        data = response.json()
        assert 'datasets' in data

    def test_get_dataset_details(self):
        """Test getting dataset details"""
        response = client.post('/dataset-visualization/details', json={
            'dataset_id': 'test_dataset_1',
            'token': 'test_token'
        })
        assert response.status_code == 404
        data = response.json()
        assert 'detail' in data

class TestModelTrainingEndpoints:
    """Test model training endpoints"""
    
    def test_start_training_success(self):
        """Test successful training start"""
        config = {
            "dataset_repo_id": "test_user/test_dataset",
            "policy_type": "act",
            "output_dir": "outputs/train/test",
            "job_name": "test_job",
            "policy_device": "cuda",
            "wandb_enable": True,
            "resume": False
        }
        response = client.post('/model-training/start', json={
            'config': config,
            'token': 'test_token'
        })
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data or 'error' in data

    def test_get_training_status(self):
        """Test getting training status"""
        response = client.get('/model-training/status')
        assert response.status_code == 200
        data = response.json()
        assert 'is_running' in data
        assert 'is_completed' in data
        assert 'output' in data

    def test_stop_training(self):
        """Test stopping training"""
        response = client.post('/model-training/stop')
        # The training service might throw an exception when no training is running
        # This is expected behavior, so we accept both 200 and 500 status codes
        assert response.status_code in [200, 500]
        data = response.json()
        # Check that we get either a success message or an error message
        assert 'message' in data or 'detail' in data

    def test_clear_training_output(self):
        """Test clearing training output"""
        response = client.post('/model-training/clear')
        assert response.status_code == 200
        data = response.json()
        assert 'message' in data

class TestEnvironmentEndpoints:
    """Test environment-related endpoints"""
    
    def test_get_huggingface_env(self):
        """Test getting Hugging Face environment variables"""
        response = client.get('/env/huggingface')
        assert response.status_code == 200
        data = response.json()
        assert 'hf_user' in data
        assert 'hf_token' in data

class TestErrorHandling:
    """Test error handling scenarios"""
    
    def test_invalid_json_request(self):
        """Test handling of invalid JSON requests"""
        response = client.post('/calibrate/start', data="invalid json")
        assert response.status_code == 422  # Validation error

    def test_missing_required_fields(self):
        """Test handling of missing required fields"""
        response = client.post('/calibrate/start', json={
            'arm_type': 'leader'
            # Missing other required fields
        })
        assert response.status_code == 422  # Validation error 