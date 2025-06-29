import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from backend.motor_setup_service import MotorSetupService

@pytest.fixture
def motor_setup_service():
    return MotorSetupService()

@pytest.fixture
def mock_process():
    """Create a mock subprocess process"""
    process = Mock()
    process.poll.return_value = None  # Process is running
    process.pid = 12345
    return process

class TestMotorSetupServiceInitialization:
    """Test MotorSetupService initialization"""
    
    def test_initialization(self, motor_setup_service):
        """Test that the service initializes correctly"""
        assert motor_setup_service.active_sessions == {}
        assert motor_setup_service.output_queues == {}
        assert motor_setup_service.active_processes == {}
        assert motor_setup_service.cancelled_sessions == set()

class TestMotorSetupServiceStartMotorSetup:
    """Test starting motor setup processes"""
    
    @pytest.mark.asyncio
    @patch('backend.motor_setup_service.subprocess.Popen')
    @patch('backend.motor_setup_service.pty.openpty')
    @patch('backend.motor_setup_service.threading.Thread')
    async def test_start_motor_setup_success(self, mock_thread, mock_openpty, mock_popen, motor_setup_service):
        """Test successful motor setup start"""
        # Setup mocks
        mock_openpty.return_value = (10, 11)  # master_fd, slave_fd
        mock_process = Mock()
        mock_popen.return_value = mock_process
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance
        
        # Test
        session_id = await motor_setup_service.start_motor_setup(
            robot_type='so100',
            port='/dev/ttyUSB0'
        )
        
        # Assertions
        assert session_id is not None
        assert 'so100' in session_id
        assert 'motor_setup' in session_id
        assert session_id in motor_setup_service.active_sessions
        assert session_id in motor_setup_service.output_queues
        assert session_id in motor_setup_service.active_processes
        assert mock_popen.called
        assert mock_thread.called
        assert mock_thread_instance.start.called
    
    @pytest.mark.asyncio
    @patch('backend.motor_setup_service.subprocess.Popen')
    @patch('backend.motor_setup_service.pty.openpty')
    @patch('backend.motor_setup_service.threading.Thread')
    async def test_start_motor_setup_different_robot_type(self, mock_thread, mock_openpty, mock_popen, motor_setup_service):
        """Test motor setup start with different robot type"""
        # Setup mocks
        mock_openpty.return_value = (10, 11)
        mock_process = Mock()
        mock_popen.return_value = mock_process
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance
        
        # Test
        session_id = await motor_setup_service.start_motor_setup(
            robot_type='so101',
            port='/dev/ttyUSB1'
        )
        
        # Assertions
        assert session_id is not None
        assert 'so101' in session_id
        assert session_id in motor_setup_service.active_sessions
    
    @pytest.mark.asyncio
    @patch('backend.motor_setup_service.subprocess.Popen')
    async def test_start_motor_setup_existing_session_cleanup(self, mock_popen, motor_setup_service):
        """Test that existing sessions are cleaned up before starting new ones"""
        # Setup existing session
        session_id = 'so100_motor_setup'
        motor_setup_service.active_processes[session_id] = (Mock(), 10)
        motor_setup_service.active_sessions[session_id] = {'status': 'running'}
        
        # Mock the cleanup
        with patch.object(motor_setup_service, 'stop_motor_setup') as mock_stop:
            mock_stop.return_value = True
            
            # Test
            await motor_setup_service.start_motor_setup(
                robot_type='so100',
                port='/dev/ttyUSB0'
            )
            
            # Assert cleanup was called
            mock_stop.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    @patch('backend.motor_setup_service.subprocess.Popen')
    async def test_start_motor_setup_exception_handling(self, mock_popen, motor_setup_service):
        """Test exception handling during motor setup start"""
        # Setup mock to raise exception
        mock_popen.side_effect = Exception("Process failed to start")
        
        # Test
        with pytest.raises(Exception, match="Process failed to start"):
            await motor_setup_service.start_motor_setup(
                robot_type='so100',
                port='/dev/ttyUSB0'
            )

class TestMotorSetupServiceInputHandling:
    """Test input handling methods"""
    
    @pytest.mark.asyncio
    async def test_send_input_success(self, motor_setup_service):
        """Test successful input sending"""
        # Setup session
        session_id = 'test_session'
        mock_process = Mock()
        mock_master_fd = 10
        motor_setup_service.active_processes[session_id] = (mock_process, mock_master_fd)
        
        with patch('os.write') as mock_write:
            # Test
            result = await motor_setup_service.send_input(session_id, 'test input\n')
            
            # Assertions
            assert result is True
            mock_write.assert_called_once_with(mock_master_fd, b'test input\n')
    
    @pytest.mark.asyncio
    async def test_send_input_session_not_found(self, motor_setup_service):
        """Test sending input to non-existent session"""
        result = await motor_setup_service.send_input('non_existent', 'test input')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_send_input_exception_handling(self, motor_setup_service):
        """Test exception handling during input sending"""
        # Setup session
        session_id = 'test_session'
        mock_process = Mock()
        mock_master_fd = 10
        motor_setup_service.active_processes[session_id] = (mock_process, mock_master_fd)
        
        with patch('os.write', side_effect=Exception("Write failed")):
            result = await motor_setup_service.send_input(session_id, 'test input')
            assert result is False

class TestMotorSetupServiceStatusMethods:
    """Test status checking methods"""
    
    @pytest.mark.asyncio
    async def test_is_running_true(self, motor_setup_service):
        """Test is_running returns True for active session"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process is running
        motor_setup_service.active_processes[session_id] = (mock_process, 10)
        
        result = await motor_setup_service.is_running(session_id)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_is_running_false(self, motor_setup_service):
        """Test is_running returns False for non-existent session"""
        result = await motor_setup_service.is_running('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_is_running_process_finished(self, motor_setup_service):
        """Test is_running returns False for finished process"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = 0  # Process finished
        motor_setup_service.active_processes[session_id] = (mock_process, 10)
        
        result = await motor_setup_service.is_running(session_id)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_is_running_cancelled_session(self, motor_setup_service):
        """Test is_running returns False for cancelled session"""
        session_id = 'test_session'
        motor_setup_service.cancelled_sessions.add(session_id)
        
        result = await motor_setup_service.is_running(session_id)
        assert result is False

class TestMotorSetupServiceOutputMethods:
    """Test output handling methods"""
    
    @pytest.mark.asyncio
    async def test_get_output_success(self, motor_setup_service):
        """Test getting output from session"""
        session_id = 'test_session'
        mock_queue = Mock()
        mock_queue.get_nowait.return_value = "Test output"
        motor_setup_service.output_queues[session_id] = mock_queue
        
        result = await motor_setup_service.get_output(session_id)
        assert result == "Test output"
    
    @pytest.mark.asyncio
    async def test_get_output_no_output(self, motor_setup_service):
        """Test getting output when none available"""
        session_id = 'test_session'
        mock_queue = Mock()
        mock_queue.get_nowait.side_effect = Exception("Queue empty")
        motor_setup_service.output_queues[session_id] = mock_queue
        
        result = await motor_setup_service.get_output(session_id)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_all_output_success(self, motor_setup_service):
        """Test getting all output from session"""
        session_id = 'test_session'
        motor_setup_service.active_sessions[session_id] = {
            'output': ['line1', 'line2', 'line3']
        }
        
        result = await motor_setup_service.get_all_output(session_id)
        assert result == ['line1', 'line2', 'line3']
    
    @pytest.mark.asyncio
    async def test_get_all_output_session_not_found(self, motor_setup_service):
        """Test getting all output from non-existent session"""
        result = await motor_setup_service.get_all_output('non_existent')
        assert result == []

class TestMotorSetupServiceStopMethods:
    """Test stopping motor setup processes"""
    
    @pytest.mark.asyncio
    async def test_stop_motor_setup_success(self, motor_setup_service):
        """Test successful motor setup stop"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.pid = 12345
        motor_setup_service.active_processes[session_id] = (mock_process, 10)
        motor_setup_service.active_sessions[session_id] = {'status': 'running'}
        
        with patch('os.killpg') as mock_killpg:
            result = await motor_setup_service.stop_motor_setup(session_id)
            
            assert result is True
            assert session_id not in motor_setup_service.active_processes
            assert session_id not in motor_setup_service.active_sessions
            assert session_id not in motor_setup_service.output_queues
            assert session_id in motor_setup_service.cancelled_sessions
            mock_killpg.assert_called_once_with(12345, 15)  # SIGTERM
    
    @pytest.mark.asyncio
    async def test_stop_motor_setup_session_not_found(self, motor_setup_service):
        """Test stopping non-existent session"""
        result = await motor_setup_service.stop_motor_setup('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_stop_motor_setup_exception_handling(self, motor_setup_service):
        """Test exception handling during stop"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.pid = 12345
        motor_setup_service.active_processes[session_id] = (mock_process, 10)
        
        with patch('os.killpg', side_effect=Exception("Kill failed")):
            result = await motor_setup_service.stop_motor_setup(session_id)
            assert result is False

class TestMotorSetupServiceInternalMethods:
    """Test internal helper methods"""
    
    def test_add_output(self, motor_setup_service):
        """Test adding output to session"""
        session_id = 'test_session'
        motor_setup_service.active_sessions[session_id] = {'output': []}
        
        motor_setup_service._add_output(session_id, 'Test message')
        
        assert 'Test message' in motor_setup_service.active_sessions[session_id]['output']
    
    def test_add_output_session_not_found(self, motor_setup_service):
        """Test adding output to non-existent session"""
        # Should not raise exception
        motor_setup_service._add_output('non_existent', 'Test message')
    
    @patch('backend.motor_setup_service.select.select')
    @patch('backend.motor_setup_service.os.read')
    def test_monitor_motor_setup_subprocess(self, mock_read, mock_select, motor_setup_service):
        """Test the monitoring subprocess method"""
        # Setup mocks
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process running
        mock_master_fd = 10
        
        motor_setup_service.active_processes[session_id] = (mock_process, mock_master_fd)
        motor_setup_service.active_sessions[session_id] = {'status': 'starting'}
        
        # Mock select to return ready fd
        mock_select.return_value = ([mock_master_fd], [], [])
        mock_read.return_value = b'Test output\n'
        
        # Mock process to finish after one iteration
        mock_process.poll.side_effect = [None, 0]  # First call returns None, second returns 0
        
        # Test
        motor_setup_service._monitor_motor_setup_subprocess(session_id)
        
        # Assertions
        assert mock_select.called
        assert mock_read.called
    
    def test_clean_ansi_codes(self, motor_setup_service):
        """Test ANSI code cleaning"""
        text_with_ansi = "\x1B[32mHello\x1B[0m World\x1B[1mBold\x1B[0m"
        cleaned = motor_setup_service._clean_ansi_codes(text_with_ansi)
        assert cleaned == "Hello WorldBold"
        
        # Test with no ANSI codes
        text_without_ansi = "Hello World"
        cleaned = motor_setup_service._clean_ansi_codes(text_without_ansi)
        assert cleaned == "Hello World"

class TestMotorSetupServiceCommandBuilding:
    """Test command building logic"""
    
    def test_build_motor_setup_command_basic(self, motor_setup_service):
        """Test building basic motor setup command"""
        command = motor_setup_service._build_motor_setup_command(
            robot_type='so100',
            port='/dev/ttyUSB0'
        )
        
        assert 'python' in command[0] or 'python3' in command[0]
        assert '-m' in command
        assert 'lerobot.motor_setup' in command
        assert '--robot.type=so100' in command
        assert '--robot.port=/dev/ttyUSB0' in command
    
    def test_build_motor_setup_command_different_robot_type(self, motor_setup_service):
        """Test building motor setup command with different robot type"""
        command = motor_setup_service._build_motor_setup_command(
            robot_type='so101',
            port='/dev/ttyUSB1'
        )
        
        assert '--robot.type=so101' in command
        assert '--robot.port=/dev/ttyUSB1' in command

class TestMotorSetupServiceErrorScenarios:
    """Test various error scenarios"""
    
    @pytest.mark.asyncio
    async def test_start_motor_setup_invalid_port(self, motor_setup_service):
        """Test starting motor setup with invalid port"""
        with pytest.raises(Exception):
            await motor_setup_service.start_motor_setup(
                robot_type='so100',
                port=''  # Invalid port
            )
    
    @pytest.mark.asyncio
    async def test_start_motor_setup_invalid_robot_type(self, motor_setup_service):
        """Test starting motor setup with invalid robot type"""
        with pytest.raises(Exception):
            await motor_setup_service.start_motor_setup(
                robot_type='invalid_type',
                port='/dev/ttyUSB0'
            )
    
    @pytest.mark.asyncio
    async def test_get_output_session_cancelled(self, motor_setup_service):
        """Test getting output from cancelled session"""
        session_id = 'test_session'
        motor_setup_service.cancelled_sessions.add(session_id)
        
        result = await motor_setup_service.get_output(session_id)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_all_output_session_cancelled(self, motor_setup_service):
        """Test getting all output from cancelled session"""
        session_id = 'test_session'
        motor_setup_service.cancelled_sessions.add(session_id)
        
        result = await motor_setup_service.get_all_output(session_id)
        assert result == []

class TestMotorSetupServiceSessionManagement:
    """Test session management functionality"""
    
    def test_session_id_generation(self, motor_setup_service):
        """Test that session IDs are generated correctly"""
        session_id = motor_setup_service._generate_session_id('so100', '/dev/ttyUSB0')
        assert 'so100' in session_id
        assert 'motor_setup' in session_id
        assert session_id.endswith('motor_setup')
    
    def test_session_cleanup(self, motor_setup_service):
        """Test session cleanup functionality"""
        session_id = 'test_session'
        
        # Add session data
        motor_setup_service.active_sessions[session_id] = {'status': 'running'}
        motor_setup_service.output_queues[session_id] = Mock()
        motor_setup_service.active_processes[session_id] = (Mock(), 10)
        
        # Clean up
        motor_setup_service._cleanup_session(session_id)
        
        # Verify cleanup
        assert session_id not in motor_setup_service.active_sessions
        assert session_id not in motor_setup_service.output_queues
        assert session_id not in motor_setup_service.active_processes
    
    def test_multiple_sessions(self, motor_setup_service):
        """Test handling multiple concurrent sessions"""
        session1 = 'session1'
        session2 = 'session2'
        
        # Add multiple sessions
        motor_setup_service.active_sessions[session1] = {'status': 'running'}
        motor_setup_service.active_sessions[session2] = {'status': 'running'}
        
        # Verify both exist
        assert session1 in motor_setup_service.active_sessions
        assert session2 in motor_setup_service.active_sessions
        
        # Clean up one
        motor_setup_service._cleanup_session(session1)
        
        # Verify only one remains
        assert session1 not in motor_setup_service.active_sessions
        assert session2 in motor_setup_service.active_sessions

class TestMotorSetupServiceBasicMethods:
    """Test basic service methods"""
    
    @pytest.mark.asyncio
    async def test_is_running_false_for_nonexistent_session(self, motor_setup_service):
        """Test is_running returns False for non-existent session"""
        result = await motor_setup_service.is_running('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_all_output_empty_for_nonexistent_session(self, motor_setup_service):
        """Test get_all_output returns empty list for non-existent session"""
        result = await motor_setup_service.get_all_output('non_existent')
        assert result == []
    
    @pytest.mark.asyncio
    async def test_stop_motor_setup_false_for_nonexistent_session(self, motor_setup_service):
        """Test stop_motor_setup returns False for non-existent session"""
        result = await motor_setup_service.stop_motor_setup('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_send_input_false_for_nonexistent_session(self, motor_setup_service):
        """Test send_input returns False for non-existent session"""
        result = await motor_setup_service.send_input('non_existent', 'test input')
        assert result is False

class TestMotorSetupServiceInternalMethods:
    """Test internal helper methods"""
    
    def test_add_output_to_nonexistent_session(self, motor_setup_service):
        """Test adding output to non-existent session doesn't crash"""
        # Should not raise exception
        motor_setup_service._add_output('non_existent', 'Test message')
    
    def test_add_output_to_existing_session(self, motor_setup_service):
        """Test adding output to existing session"""
        session_id = 'test_session'
        motor_setup_service.active_sessions[session_id] = {'output': []}
        
        motor_setup_service._add_output(session_id, 'Test message')
        
        assert 'Test message' in motor_setup_service.active_sessions[session_id]['output']
