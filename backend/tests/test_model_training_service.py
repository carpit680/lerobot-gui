import pytest
import time
from unittest.mock import Mock, patch
from model_training_service import ModelTrainingService, TrainingConfig

@pytest.fixture
def training_service():
    return ModelTrainingService()

@pytest.fixture
def sample_config():
    return TrainingConfig(
        dataset_repo_id="test_user/test_dataset",
        policy_type="act",
        output_dir="outputs/train/test",
        job_name="test_job",
        policy_device="cuda",
        wandb_enable=True,
        policy_repo_id="test_user/test_policy"
    )

def test_training_service_initialization(training_service):
    """Test that the training service initializes correctly"""
    assert training_service.current_process is None
    assert training_service.output_buffer == []
    assert training_service.is_running is False
    assert training_service.is_completed is False
    assert training_service.error_message is None

def test_start_training_already_running(training_service, sample_config):
    """Test that starting training when already running returns an error"""
    training_service.is_running = True
    
    result = training_service.start_training(sample_config)
    
    assert "error" in result
    assert "already running" in result["error"]

@patch('subprocess.Popen')
def test_start_training_success(mock_popen, training_service, sample_config):
    """Test successful training start"""
    mock_process = Mock()
    mock_process.stdout.readline.return_value = ""
    mock_process.wait.return_value = 0
    mock_popen.return_value = mock_process
    
    result = training_service.start_training(sample_config)
    
    assert "message" in result
    assert "started successfully" in result["message"]
    assert training_service.is_running is True
    assert mock_popen.called

@patch('subprocess.Popen')
def test_start_training_failure(mock_popen, training_service, sample_config):
    """Test training start failure"""
    mock_popen.side_effect = Exception("Process failed to start")
    
    result = training_service.start_training(sample_config)
    
    assert "error" in result
    assert "Failed to start training" in result["error"]
    assert training_service.is_running is False

def test_stop_training_not_running(training_service):
    """Test stopping training when not running"""
    result = training_service.stop_training()
    
    assert "message" in result
    assert "No training process to stop" in result["message"]

@patch('os.killpg')
@patch('time.sleep')
def test_stop_training_success(mock_sleep, mock_killpg, training_service):
    """Test successful training stop"""
    mock_process = Mock()
    mock_process.pid = 12345
    mock_process.poll.return_value = None
    mock_process.wait.return_value = 0
    training_service.current_process = mock_process
    training_service.is_running = True
    
    result = training_service.stop_training()
    
    assert "message" in result
    assert "stopped successfully" in result["message"]
    assert mock_killpg.called

def test_get_status(training_service):
    """Test getting training status"""
    training_service.is_running = True
    training_service.is_completed = False
    training_service.error_message = None
    training_service.output_buffer = ["line1", "line2"]
    training_service.start_time = None
    
    status = training_service.get_status()
    
    assert status["is_running"] is True
    assert status["is_completed"] is False
    assert status["error"] is None
    assert status["output"] == ["line1", "line2"]
    assert status["start_time"] is None

def test_clear_output(training_service):
    """Test clearing output buffer"""
    training_service.output_buffer = ["line1", "line2", "line3"]
    
    training_service.clear_output()
    
    assert training_service.output_buffer == []

def test_monitor_output_completion(training_service):
    """Test output monitoring when process completes successfully"""
    mock_process = Mock()
    mock_process.stdout.readline.side_effect = ["line1\n", "line2\n", ""]
    mock_process.wait.return_value = 0
    training_service.current_process = mock_process
    
    training_service._monitor_output()
    
    assert training_service.output_buffer == ["line1", "line2"]
    assert training_service.is_completed is True
    assert training_service.is_running is False

def test_monitor_output_failure(training_service):
    """Test output monitoring when process fails"""
    mock_process = Mock()
    mock_process.stdout.readline.side_effect = ["line1\n", "line2\n", ""]
    mock_process.wait.return_value = 1
    training_service.current_process = mock_process
    
    training_service._monitor_output()
    
    assert training_service.output_buffer == ["line1", "line2"]
    assert training_service.is_completed is False
    assert training_service.error_message is not None
    assert training_service.is_running is False 