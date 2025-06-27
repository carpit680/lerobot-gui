import pytest
import asyncio
from backend.dataset_replay_service import DatasetReplayService

@pytest.fixture
def dataset_replay_service():
    return DatasetReplayService()

@pytest.mark.asyncio
async def test_start_dataset_replay(dataset_replay_service):
    """Test starting a dataset replay session"""
    session_id = await dataset_replay_service.start_dataset_replay(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem58760431541",
        robot_id="my_awesome_follower_arm",
        dataset_repo_id="test_user/record-test",
        episode=0
    )
    
    assert session_id is not None
    assert "my_awesome_follower_arm" in session_id
    assert "replay" in session_id

@pytest.mark.asyncio
async def test_is_running(dataset_replay_service):
    """Test checking if a session is running"""
    # Start a session
    session_id = await dataset_replay_service.start_dataset_replay(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem58760431541",
        robot_id="test_follower",
        dataset_repo_id="test_user/record-test"
    )
    
    # Check if running
    is_running = await dataset_replay_service.is_running(session_id)
    assert is_running == True
    
    # Stop the session
    await dataset_replay_service.stop_dataset_replay(session_id)
    
    # Check if still running
    is_running = await dataset_replay_service.is_running(session_id)
    assert is_running == False

@pytest.mark.asyncio
async def test_stop_dataset_replay(dataset_replay_service):
    """Test stopping a dataset replay session"""
    # Start a session
    session_id = await dataset_replay_service.start_dataset_replay(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem58760431541",
        robot_id="test_follower",
        dataset_repo_id="test_user/record-test"
    )
    
    # Stop the session
    success = await dataset_replay_service.stop_dataset_replay(session_id)
    assert success == True
    
    # Try to stop again (should return False)
    success = await dataset_replay_service.stop_dataset_replay(session_id)
    assert success == False

@pytest.mark.asyncio
async def test_get_all_output(dataset_replay_service):
    """Test getting output from a session"""
    # Start a session
    session_id = await dataset_replay_service.start_dataset_replay(
        robot_type="so101_follower",
        robot_port="/dev/tty.usbmodem58760431541",
        robot_id="test_follower",
        dataset_repo_id="test_user/record-test"
    )
    
    # Get output
    output = await dataset_replay_service.get_all_output(session_id)
    assert isinstance(output, list)
    
    # Stop the session
    await dataset_replay_service.stop_dataset_replay(session_id)

def test_clean_ansi_codes(dataset_replay_service):
    """Test cleaning ANSI escape codes from text"""
    text_with_ansi = "\x1B[32mHello\x1B[0m World\x1B[1mBold\x1B[0m"
    cleaned = dataset_replay_service._clean_ansi_codes(text_with_ansi)
    assert cleaned == "Hello WorldBold"
    
    # Test with no ANSI codes
    text_without_ansi = "Hello World"
    cleaned = dataset_replay_service._clean_ansi_codes(text_without_ansi)
    assert cleaned == "Hello World" 