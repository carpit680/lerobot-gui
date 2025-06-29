import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from backend.teleoperation_service import TeleoperationService

@pytest.fixture
def teleop_service():
    return TeleoperationService()

@pytest.fixture
def mock_process():
    """Create a mock subprocess process"""
    process = Mock()
    process.poll.return_value = None  # Process is running
    process.pid = 12345
    return process

class TestTeleoperationServiceInitialization:
    """Test TeleoperationService initialization"""
    
    def test_initialization(self, teleop_service):
        """Test that the service initializes correctly"""
        assert teleop_service.active_sessions == {}
        assert teleop_service.output_queues == {}
        assert teleop_service.active_processes == {}
        assert teleop_service.cancelled_sessions == set()

class TestTeleoperationServiceStartTeleoperation:
    """Test starting teleoperation processes"""
    
    @pytest.mark.asyncio
    @patch('backend.teleoperation_service.subprocess.Popen')
    @patch('backend.teleoperation_service.pty.openpty')
    @patch('backend.teleoperation_service.threading.Thread')
    async def test_start_teleoperation_success(self, mock_thread, mock_openpty, mock_popen, teleop_service):
        """Test successful teleoperation start"""
        # Setup mocks
        mock_openpty.return_value = (10, 11)  # master_fd, slave_fd
        mock_process = Mock()
        mock_popen.return_value = mock_process
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance
        
        # Test
        session_id = await teleop_service.start_teleoperation(
            leader_type='so100_leader',
            leader_port='/dev/ttyUSB0',
            leader_id='leader_robot',
            follower_type='so100_follower',
            follower_port='/dev/ttyUSB1',
            follower_id='follower_robot',
            cameras=[]
        )
        
        # Assertions
        assert session_id is not None
        assert 'leader_robot' in session_id
        assert 'follower_robot' in session_id
        assert 'teleop' in session_id
        assert session_id in teleop_service.active_sessions
        assert session_id in teleop_service.output_queues
        assert session_id in teleop_service.active_processes
        assert mock_popen.called
        assert mock_thread.called
        assert mock_thread_instance.start.called
    
    @pytest.mark.asyncio
    @patch('backend.teleoperation_service.subprocess.Popen')
    @patch('backend.teleoperation_service.pty.openpty')
    @patch('backend.teleoperation_service.threading.Thread')
    async def test_start_teleoperation_with_cameras(self, mock_thread, mock_openpty, mock_popen, teleop_service):
        """Test teleoperation start with camera configuration"""
        # Setup mocks
        mock_openpty.return_value = (10, 11)
        mock_process = Mock()
        mock_popen.return_value = mock_process
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance
        
        cameras = [
            {
                "name": "front_camera",
                "type": "opencv",
                "index": 0,
                "width": 1920,
                "height": 1080,
                "fps": 30
            }
        ]
        
        # Test
        session_id = await teleop_service.start_teleoperation(
            leader_type='so100_leader',
            leader_port='/dev/ttyUSB0',
            leader_id='leader_robot',
            follower_type='so100_follower',
            follower_port='/dev/ttyUSB1',
            follower_id='follower_robot',
            cameras=cameras
        )
        
        # Assertions
        assert session_id is not None
        assert session_id in teleop_service.active_sessions
        session_data = teleop_service.active_sessions[session_id]
        assert session_data['cameras'] == cameras
    
    @pytest.mark.asyncio
    @patch('backend.teleoperation_service.subprocess.Popen')
    async def test_start_teleoperation_existing_session_cleanup(self, mock_popen, teleop_service):
        """Test that existing sessions are cleaned up before starting new ones"""
        # Setup existing session
        session_id = 'leader_robot_follower_robot_teleop'
        teleop_service.active_processes[session_id] = (Mock(), 10)
        teleop_service.active_sessions[session_id] = {'status': 'running'}
        
        # Mock the cleanup
        with patch.object(teleop_service, 'stop_teleoperation') as mock_stop:
            mock_stop.return_value = True
            
            # Test
            await teleop_service.start_teleoperation(
                leader_type='so100_leader',
                leader_port='/dev/ttyUSB0',
                leader_id='leader_robot',
                follower_type='so100_follower',
                follower_port='/dev/ttyUSB1',
                follower_id='follower_robot',
                cameras=[]
            )
            
            # Assert cleanup was called
            mock_stop.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    @patch('backend.teleoperation_service.subprocess.Popen')
    async def test_start_teleoperation_exception_handling(self, mock_popen, teleop_service):
        """Test exception handling during teleoperation start"""
        # Setup mock to raise exception
        mock_popen.side_effect = Exception("Process failed to start")
        
        # Test
        with pytest.raises(Exception, match="Process failed to start"):
            await teleop_service.start_teleoperation(
                leader_type='so100_leader',
                leader_port='/dev/ttyUSB0',
                leader_id='leader_robot',
                follower_type='so100_follower',
                follower_port='/dev/ttyUSB1',
                follower_id='follower_robot',
                cameras=[]
            )

class TestTeleoperationServiceStatusMethods:
    """Test status checking methods"""
    
    @pytest.mark.asyncio
    async def test_is_running_true(self, teleop_service):
        """Test is_running returns True for active session"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process is running
        teleop_service.active_processes[session_id] = (mock_process, 10)
        
        result = await teleop_service.is_running(session_id)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_is_running_false(self, teleop_service):
        """Test is_running returns False for non-existent session"""
        result = await teleop_service.is_running('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_is_running_process_finished(self, teleop_service):
        """Test is_running returns False for finished process"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = 0  # Process finished
        teleop_service.active_processes[session_id] = (mock_process, 10)
        
        result = await teleop_service.is_running(session_id)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_is_running_cancelled_session(self, teleop_service):
        """Test is_running returns False for cancelled session"""
        session_id = 'test_session'
        teleop_service.cancelled_sessions.add(session_id)
        
        result = await teleop_service.is_running(session_id)
        assert result is False

class TestTeleoperationServiceOutputMethods:
    """Test output handling methods"""
    
    @pytest.mark.asyncio
    async def test_get_output_success(self, teleop_service):
        """Test getting output from session"""
        session_id = 'test_session'
        mock_queue = Mock()
        mock_queue.get_nowait.return_value = "Test output"
        teleop_service.output_queues[session_id] = mock_queue
        
        result = await teleop_service.get_output(session_id)
        assert result == "Test output"
    
    @pytest.mark.asyncio
    async def test_get_output_no_output(self, teleop_service):
        """Test getting output when none available"""
        session_id = 'test_session'
        mock_queue = Mock()
        mock_queue.get_nowait.side_effect = Exception("Queue empty")
        teleop_service.output_queues[session_id] = mock_queue
        
        result = await teleop_service.get_output(session_id)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_all_output_success(self, teleop_service):
        """Test getting all output from session"""
        session_id = 'test_session'
        teleop_service.active_sessions[session_id] = {
            'output': ['line1', 'line2', 'line3']
        }
        
        result = await teleop_service.get_all_output(session_id)
        assert result == ['line1', 'line2', 'line3']
    
    @pytest.mark.asyncio
    async def test_get_all_output_session_not_found(self, teleop_service):
        """Test getting all output from non-existent session"""
        result = await teleop_service.get_all_output('non_existent')
        assert result == []

class TestTeleoperationServiceStopMethods:
    """Test stopping teleoperation processes"""
    
    @pytest.mark.asyncio
    async def test_stop_teleoperation_success(self, teleop_service):
        """Test successful teleoperation stop"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.pid = 12345
        teleop_service.active_processes[session_id] = (mock_process, 10)
        teleop_service.active_sessions[session_id] = {'status': 'running'}
        
        with patch('os.killpg') as mock_killpg:
            result = await teleop_service.stop_teleoperation(session_id)
            
            assert result is True
            assert session_id not in teleop_service.active_processes
            assert session_id not in teleop_service.active_sessions
            assert session_id not in teleop_service.output_queues
            assert session_id in teleop_service.cancelled_sessions
            mock_killpg.assert_called_once_with(12345, 15)  # SIGTERM
    
    @pytest.mark.asyncio
    async def test_stop_teleoperation_session_not_found(self, teleop_service):
        """Test stopping non-existent session"""
        result = await teleop_service.stop_teleoperation('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_stop_teleoperation_exception_handling(self, teleop_service):
        """Test exception handling during stop"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.pid = 12345
        teleop_service.active_processes[session_id] = (mock_process, 10)
        
        with patch('os.killpg', side_effect=Exception("Kill failed")):
            result = await teleop_service.stop_teleoperation(session_id)
            assert result is False

class TestTeleoperationServiceInternalMethods:
    """Test internal helper methods"""
    
    def test_add_output_to_nonexistent_session(self, teleop_service):
        """Test adding output to non-existent session doesn't crash"""
        # Should not raise exception
        teleop_service._add_output('non_existent', 'Test message')
    
    def test_add_output_to_existing_session(self, teleop_service):
        """Test adding output to existing session"""
        session_id = 'test_session'
        teleop_service.active_sessions[session_id] = {'output': []}
        
        teleop_service._add_output(session_id, 'Test message')
        
        assert 'Test message' in teleop_service.active_sessions[session_id]['output']
    
    def test_clean_ansi_codes(self, teleop_service):
        """Test ANSI code cleaning"""
        text_with_ansi = "\x1B[32mHello\x1B[0m World\x1B[1mBold\x1B[0m"
        cleaned = teleop_service._clean_ansi_codes(text_with_ansi)
        assert cleaned == "Hello WorldBold"
        
        # Test with no ANSI codes
        text_without_ansi = "Hello World"
        cleaned = teleop_service._clean_ansi_codes(text_without_ansi)
        assert cleaned == "Hello World"

class TestTeleoperationServiceCommandBuilding:
    """Test command building logic"""
    
    def test_build_teleoperation_command_basic(self, teleop_service):
        """Test building basic teleoperation command"""
        command = teleop_service._build_teleoperation_command(
            leader_type='so100_leader',
            leader_port='/dev/ttyUSB0',
            leader_id='leader_robot',
            follower_type='so100_follower',
            follower_port='/dev/ttyUSB1',
            follower_id='follower_robot',
            cameras=[]
        )
        
        assert 'python' in command[0] or 'python3' in command[0]
        assert '-m' in command
        assert 'lerobot.teleop' in command
        assert '--leader.type=so100_leader' in command
        assert '--leader.port=/dev/ttyUSB0' in command
        assert '--leader.id=leader_robot' in command
        assert '--follower.type=so100_follower' in command
        assert '--follower.port=/dev/ttyUSB1' in command
        assert '--follower.id=follower_robot' in command
    
    def test_build_teleoperation_command_with_cameras(self, teleop_service):
        """Test building teleoperation command with camera configuration"""
        cameras = [
            {
                "name": "front_camera",
                "type": "opencv",
                "index": 0,
                "width": 1920,
                "height": 1080,
                "fps": 30
            }
        ]
        
        command = teleop_service._build_teleoperation_command(
            leader_type='so100_leader',
            leader_port='/dev/ttyUSB0',
            leader_id='leader_robot',
            follower_type='so100_follower',
            follower_port='/dev/ttyUSB1',
            follower_id='follower_robot',
            cameras=cameras
        )
        
        # Check that camera configuration is included
        camera_args = [arg for arg in command if 'camera' in arg.lower()]
        assert len(camera_args) > 0

class TestTeleoperationServiceErrorScenarios:
    """Test various error scenarios"""
    
    @pytest.mark.asyncio
    async def test_start_teleoperation_invalid_ports(self, teleop_service):
        """Test starting teleoperation with invalid ports"""
        with pytest.raises(Exception):
            await teleop_service.start_teleoperation(
                leader_type='so100_leader',
                leader_port='',  # Invalid port
                leader_id='leader_robot',
                follower_type='so100_follower',
                follower_port='',  # Invalid port
                follower_id='follower_robot',
                cameras=[]
            )
    
    @pytest.mark.asyncio
    async def test_start_teleoperation_invalid_robot_types(self, teleop_service):
        """Test starting teleoperation with invalid robot types"""
        with pytest.raises(Exception):
            await teleop_service.start_teleoperation(
                leader_type='invalid_type',
                leader_port='/dev/ttyUSB0',
                leader_id='leader_robot',
                follower_type='invalid_type',
                follower_port='/dev/ttyUSB1',
                follower_id='follower_robot',
                cameras=[]
            )
    
    @pytest.mark.asyncio
    async def test_get_output_session_cancelled(self, teleop_service):
        """Test getting output from cancelled session"""
        session_id = 'test_session'
        teleop_service.cancelled_sessions.add(session_id)
        
        result = await teleop_service.get_output(session_id)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_all_output_session_cancelled(self, teleop_service):
        """Test getting all output from cancelled session"""
        session_id = 'test_session'
        teleop_service.cancelled_sessions.add(session_id)
        
        result = await teleop_service.get_all_output(session_id)
        assert result == []

class TestTeleoperationServiceBasicMethods:
    """Test basic service methods"""
    
    @pytest.mark.asyncio
    async def test_is_running_false_for_nonexistent_session(self, teleop_service):
        """Test is_running returns False for non-existent session"""
        result = await teleop_service.is_running('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_all_output_empty_for_nonexistent_session(self, teleop_service):
        """Test get_all_output returns empty list for non-existent session"""
        result = await teleop_service.get_all_output('non_existent')
        assert result == []
    
    @pytest.mark.asyncio
    async def test_stop_teleoperation_false_for_nonexistent_session(self, teleop_service):
        """Test stop_teleoperation returns False for non-existent session"""
        result = await teleop_service.stop_teleoperation('non_existent')
        assert result is False
