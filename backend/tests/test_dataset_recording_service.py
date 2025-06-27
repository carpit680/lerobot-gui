import pytest
import asyncio
from backend.dataset_recording_service import DatasetRecordingService

@pytest.fixture
def dataset_recording_service():
    return DatasetRecordingService()

@pytest.mark.asyncio
async def test_start_dataset_recording(dataset_recording_service):
    """Test starting a dataset recording session"""
    session_id = await dataset_recording_service.start_dataset_recording(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem585A0076841",
        robot_id="my_awesome_follower_arm",
        teleop_type="so101_leader",
        teleop_port="/dev/tty.usbmodem58760431551",
        teleop_id="my_awesome_leader_arm",
        cameras=[{
            "name": "front",
            "type": "opencv",
            "index": 0,
            "width": 1920,
            "height": 1080,
            "fps": 30
        }],
        display_data=True,
        dataset_repo_id="test_user/record-test",
        num_episodes=5,
        single_task="Grab the black cube",
        push_to_hub=False,
        resume=True,
        episode_time_s=60,
        reset_time_s=60
    )
    
    assert session_id is not None
    assert "my_awesome_follower_arm" in session_id
    assert "my_awesome_leader_arm" in session_id
    assert "recording" in session_id

@pytest.mark.asyncio
async def test_is_running(dataset_recording_service):
    """Test checking if a session is running"""
    # Start a session
    session_id = await dataset_recording_service.start_dataset_recording(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem585A0076841",
        robot_id="test_follower",
        teleop_type="so101_leader",
        teleop_port="/dev/tty.usbmodem58760431551",
        teleop_id="test_leader",
        num_episodes=1,
        single_task="Test task"
    )
    
    # Check if running
    is_running = await dataset_recording_service.is_running(session_id)
    assert is_running == True
    
    # Stop the session
    await dataset_recording_service.stop_dataset_recording(session_id)
    
    # Check if still running
    is_running = await dataset_recording_service.is_running(session_id)
    assert is_running == False

@pytest.mark.asyncio
async def test_stop_dataset_recording(dataset_recording_service):
    """Test stopping a dataset recording session"""
    # Start a session
    session_id = await dataset_recording_service.start_dataset_recording(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem585A0076841",
        robot_id="test_follower",
        teleop_type="so101_leader",
        teleop_port="/dev/tty.usbmodem58760431551",
        teleop_id="test_leader",
        num_episodes=1,
        single_task="Test task"
    )
    
    # Stop the session
    success = await dataset_recording_service.stop_dataset_recording(session_id)
    assert success == True
    
    # Try to stop again (should return False)
    success = await dataset_recording_service.stop_dataset_recording(session_id)
    assert success == False

@pytest.mark.asyncio
async def test_get_all_output(dataset_recording_service):
    """Test getting output from a session"""
    # Start a session
    session_id = await dataset_recording_service.start_dataset_recording(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem585A0076841",
        robot_id="test_follower",
        teleop_type="so101_leader",
        teleop_port="/dev/tty.usbmodem58760431551",
        teleop_id="test_leader",
        num_episodes=1,
        single_task="Test task"
    )
    
    # Get output
    output = await dataset_recording_service.get_all_output(session_id)
    assert isinstance(output, list)
    
    # Stop the session
    await dataset_recording_service.stop_dataset_recording(session_id)

def test_clean_ansi_codes(dataset_recording_service):
    """Test cleaning ANSI escape codes from text"""
    text_with_ansi = "\x1B[32mHello\x1B[0m World\x1B[1mBold\x1B[0m"
    cleaned = dataset_recording_service._clean_ansi_codes(text_with_ansi)
    assert cleaned == "Hello WorldBold"
    
    # Test with no ANSI codes
    text_without_ansi = "Hello World"
    cleaned = dataset_recording_service._clean_ansi_codes(text_without_ansi)
    assert cleaned == "Hello World" 