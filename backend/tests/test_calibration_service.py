import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from backend.calibration_service import CalibrationService, clean_ansi_codes

@pytest.fixture
def calibration_service():
    return CalibrationService()

@pytest.fixture
def mock_process():
    """Create a mock subprocess process"""
    process = Mock()
    process.poll.return_value = None  # Process is running
    process.pid = 12345
    return process

class TestCleanAnsiCodes:
    """Test the clean_ansi_codes utility function"""
    
    def test_clean_ansi_codes_basic(self):
        """Test basic ANSI code cleaning"""
        text_with_ansi = "\x1B[32mHello\x1B[0m World\x1B[1mBold\x1B[0m"
        cleaned = clean_ansi_codes(text_with_ansi)
        assert cleaned == "Hello WorldBold"
    
    def test_clean_ansi_codes_no_ansi(self):
        """Test cleaning text without ANSI codes"""
        text_without_ansi = "Hello World"
        cleaned = clean_ansi_codes(text_without_ansi)
        assert cleaned == "Hello World"
    
    def test_clean_ansi_codes_cursor_movement(self):
        """Test cleaning cursor movement codes"""
        text_with_cursor = "Hello\x1B[8AWorld\x1B[K"
        cleaned = clean_ansi_codes(text_with_cursor)
        assert cleaned == "HelloWorld"
    
    def test_clean_ansi_codes_carriage_returns(self):
        """Test cleaning carriage returns"""
        text_with_cr = "Hello\rWorld\nTest\r\n"
        cleaned = clean_ansi_codes(text_with_cr)
        assert cleaned == "HelloWorld\nTest\n"

class TestCalibrationServiceInitialization:
    """Test CalibrationService initialization"""
    
    def test_initialization(self, calibration_service):
        """Test that the service initializes correctly"""
        assert calibration_service.active_sessions == {}
        assert calibration_service.output_queues == {}
        assert calibration_service.active_processes == {}
        assert calibration_service._calibration_phases == {}
        assert calibration_service.cancelled_sessions == set()

class TestCalibrationServiceStartCalibration:
    """Test starting calibration processes"""
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.subprocess.Popen')
    @patch('backend.calibration_service.pty.openpty')
    @patch('backend.calibration_service.threading.Thread')
    async def test_start_calibration_leader_success(self, mock_thread, mock_openpty, mock_popen, calibration_service):
        """Test successful leader calibration start"""
        # Setup mocks
        mock_openpty.return_value = (10, 11)  # master_fd, slave_fd
        mock_process = Mock()
        mock_popen.return_value = mock_process
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance
        
        # Test
        session_id = await calibration_service.start_calibration(
            arm_type='leader',
            robot_type='so100_leader',
            port='/dev/ttyUSB0',
            robot_id='test_robot'
        )
        
        # Assertions
        assert session_id == 'test_robot_leader'
        assert session_id in calibration_service.active_sessions
        assert session_id in calibration_service.output_queues
        assert session_id in calibration_service.active_processes
        assert mock_popen.called
        assert mock_thread.called
        assert mock_thread_instance.start.called
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.subprocess.Popen')
    @patch('backend.calibration_service.pty.openpty')
    @patch('backend.calibration_service.threading.Thread')
    async def test_start_calibration_follower_success(self, mock_thread, mock_openpty, mock_popen, calibration_service):
        """Test successful follower calibration start"""
        # Setup mocks
        mock_openpty.return_value = (10, 11)
        mock_process = Mock()
        mock_popen.return_value = mock_process
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance
        
        # Test
        session_id = await calibration_service.start_calibration(
            arm_type='follower',
            robot_type='so100_follower',
            port='/dev/ttyUSB1',
            robot_id='test_robot'
        )
        
        # Assertions
        assert session_id == 'test_robot_follower'
        assert session_id in calibration_service.active_sessions
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.subprocess.Popen')
    async def test_start_calibration_existing_session_cleanup(self, mock_popen, calibration_service):
        """Test that existing sessions are cleaned up before starting new ones"""
        # Setup existing session
        session_id = 'test_robot_leader'
        calibration_service.active_processes[session_id] = (Mock(), 10)
        calibration_service.active_sessions[session_id] = {'status': 'running'}
        
        # Mock the cleanup
        with patch.object(calibration_service, 'stop_calibration') as mock_stop:
            mock_stop.return_value = True
            
            # Test
            await calibration_service.start_calibration(
                arm_type='leader',
                robot_type='so100_leader',
                port='/dev/ttyUSB0',
                robot_id='test_robot'
            )
            
            # Assert cleanup was called
            mock_stop.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.subprocess.Popen')
    async def test_start_calibration_exception_handling(self, mock_popen, calibration_service):
        """Test exception handling during calibration start"""
        # Setup mock to raise exception
        mock_popen.side_effect = Exception("Process failed to start")
        
        # Test
        with pytest.raises(Exception, match="Process failed to start"):
            await calibration_service.start_calibration(
                arm_type='leader',
                robot_type='so100_leader',
                port='/dev/ttyUSB0',
                robot_id='test_robot'
            )

class TestCalibrationServiceInputHandling:
    """Test input handling methods"""
    
    @pytest.mark.asyncio
    async def test_send_input_success(self, calibration_service):
        """Test successful input sending"""
        # Setup session
        session_id = 'test_session'
        mock_process = Mock()
        mock_master_fd = 10
        calibration_service.active_processes[session_id] = (mock_process, mock_master_fd)
        
        with patch('os.write') as mock_write:
            # Test
            result = await calibration_service.send_input(session_id, 'test input\n')
            
            # Assertions
            assert result is True
            mock_write.assert_called_once_with(mock_master_fd, b'test input\n')
    
    @pytest.mark.asyncio
    async def test_send_input_session_not_found(self, calibration_service):
        """Test sending input to non-existent session"""
        result = await calibration_service.send_input('non_existent', 'test input')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_send_input_exception_handling(self, calibration_service):
        """Test exception handling during input sending"""
        # Setup session
        session_id = 'test_session'
        mock_process = Mock()
        mock_master_fd = 10
        calibration_service.active_processes[session_id] = (mock_process, mock_master_fd)
        
        with patch('os.write', side_effect=Exception("Write failed")):
            result = await calibration_service.send_input(session_id, 'test input')
            assert result is False

class TestCalibrationServiceStatusMethods:
    """Test status checking methods"""
    
    @pytest.mark.asyncio
    async def test_is_running_true(self, calibration_service):
        """Test is_running returns True for active session"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process is running
        calibration_service.active_processes[session_id] = (mock_process, 10)
        
        result = await calibration_service.is_running(session_id)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_is_running_false(self, calibration_service):
        """Test is_running returns False for non-existent session"""
        result = await calibration_service.is_running('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_is_running_process_finished(self, calibration_service):
        """Test is_running returns False for finished process"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = 0  # Process finished
        calibration_service.active_processes[session_id] = (mock_process, 10)
        
        result = await calibration_service.is_running(session_id)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_is_waiting_for_input_true(self, calibration_service):
        """Test is_waiting_for_input returns True when waiting"""
        session_id = 'test_session'
        calibration_service._calibration_phases[session_id] = "waiting"
        
        result = await calibration_service.is_waiting_for_input(session_id)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_is_waiting_for_input_false(self, calibration_service):
        """Test is_waiting_for_input returns False when not waiting"""
        session_id = 'test_session'
        calibration_service._calibration_phases[session_id] = "running"
        
        result = await calibration_service.is_waiting_for_input(session_id)
        assert result is False

class TestCalibrationServiceOutputMethods:
    """Test output handling methods"""
    
    @pytest.mark.asyncio
    async def test_get_output_success(self, calibration_service):
        """Test getting output from session"""
        session_id = 'test_session'
        mock_queue = Mock()
        mock_queue.get_nowait.return_value = "Test output"
        calibration_service.output_queues[session_id] = mock_queue
        
        result = await calibration_service.get_output(session_id)
        assert result == "Test output"
    
    @pytest.mark.asyncio
    async def test_get_output_no_output(self, calibration_service):
        """Test getting output when none available"""
        session_id = 'test_session'
        mock_queue = Mock()
        mock_queue.get_nowait.side_effect = Exception("Queue empty")
        calibration_service.output_queues[session_id] = mock_queue
        
        result = await calibration_service.get_output(session_id)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_all_output_success(self, calibration_service):
        """Test getting all output from session"""
        session_id = 'test_session'
        calibration_service.active_sessions[session_id] = {
            'output': ['line1', 'line2', 'line3']
        }
        
        result = await calibration_service.get_all_output(session_id)
        assert result == ['line1', 'line2', 'line3']
    
    @pytest.mark.asyncio
    async def test_get_all_output_session_not_found(self, calibration_service):
        """Test getting all output from non-existent session"""
        result = await calibration_service.get_all_output('non_existent')
        assert result == []

class TestCalibrationServiceStopMethods:
    """Test stopping calibration processes"""
    
    @pytest.mark.asyncio
    async def test_stop_calibration_success(self, calibration_service):
        """Test successful calibration stop"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.pid = 12345
        calibration_service.active_processes[session_id] = (mock_process, 10)
        calibration_service.active_sessions[session_id] = {'status': 'running'}
        
        with patch('os.killpg') as mock_killpg:
            result = await calibration_service.stop_calibration(session_id)
            
            assert result is True
            assert session_id not in calibration_service.active_processes
            assert session_id not in calibration_service.active_sessions
            assert session_id not in calibration_service.output_queues
            mock_killpg.assert_called_once_with(12345, 15)  # SIGTERM
    
    @pytest.mark.asyncio
    async def test_stop_calibration_session_not_found(self, calibration_service):
        """Test stopping non-existent session"""
        result = await calibration_service.stop_calibration('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_stop_calibration_exception_handling(self, calibration_service):
        """Test exception handling during stop"""
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.pid = 12345
        calibration_service.active_processes[session_id] = (mock_process, 10)
        
        with patch('os.killpg', side_effect=Exception("Kill failed")):
            result = await calibration_service.stop_calibration(session_id)
            assert result is False

class TestCalibrationServiceFileMethods:
    """Test file checking methods"""
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.Path')
    async def test_check_calibration_files_exists(self, mock_path, calibration_service):
        """Test checking calibration files when they exist"""
        # Setup mock
        mock_calibration_file = Mock()
        mock_calibration_file.exists.return_value = True
        mock_calibration_file.__str__.return_value = '/path/to/calibration.json'
        mock_path.return_value = mock_calibration_file
        
        result = await calibration_service.check_calibration_files('test_robot', 'follower')
        
        assert result['has_calibration'] is True
        assert 'calibration_file' in result
        assert result['robot_id'] == 'test_robot'
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.Path')
    async def test_check_calibration_files_not_exists(self, mock_path, calibration_service):
        """Test checking calibration files when they don't exist"""
        # Setup mock
        mock_calibration_file = Mock()
        mock_calibration_file.exists.return_value = False
        mock_path.return_value = mock_calibration_file
        
        result = await calibration_service.check_calibration_files('test_robot', 'follower')
        
        assert result['has_calibration'] is False
        assert result['calibration_file'] is None
        assert result['robot_id'] == 'test_robot'
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.subprocess.run')
    async def test_list_ports_success(self, mock_run, calibration_service):
        """Test successful port listing"""
        # Setup mock
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = b'/dev/ttyUSB0\n/dev/ttyUSB1\n'
        mock_run.return_value = mock_result
        
        result = await calibration_service.list_ports()
        
        assert 'ports' in result
        assert '/dev/ttyUSB0' in result['ports']
        assert '/dev/ttyUSB1' in result['ports']
        assert 'message' in result
    
    @pytest.mark.asyncio
    @patch('backend.calibration_service.subprocess.run')
    async def test_list_ports_failure(self, mock_run, calibration_service):
        """Test port listing failure"""
        # Setup mock
        mock_result = Mock()
        mock_result.returncode = 1
        mock_result.stderr = b'Error listing ports'
        mock_run.return_value = mock_result
        
        result = await calibration_service.list_ports()
        
        assert 'ports' in result
        assert result['ports'] == []
        assert 'error' in result['message']

class TestCalibrationServiceInternalMethods:
    """Test internal helper methods"""
    
    def test_add_output(self, calibration_service):
        """Test adding output to session"""
        session_id = 'test_session'
        calibration_service.active_sessions[session_id] = {'output': []}
        
        calibration_service._add_output(session_id, 'Test message')
        
        assert 'Test message' in calibration_service.active_sessions[session_id]['output']
    
    def test_add_output_session_not_found(self, calibration_service):
        """Test adding output to non-existent session"""
        # Should not raise exception
        calibration_service._add_output('non_existent', 'Test message')
    
    @patch('backend.calibration_service.select.select')
    @patch('backend.calibration_service.os.read')
    def test_monitor_calibration_subprocess(self, mock_read, mock_select, calibration_service):
        """Test the monitoring subprocess method"""
        # Setup mocks
        session_id = 'test_session'
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process running
        mock_master_fd = 10
        
        calibration_service.active_processes[session_id] = (mock_process, mock_master_fd)
        calibration_service.active_sessions[session_id] = {'status': 'starting'}
        
        # Mock select to return ready fd
        mock_select.return_value = ([mock_master_fd], [], [])
        mock_read.return_value = b'Test output\n'
        
        # Mock process to finish after one iteration
        def poll_side_effect():
            mock_process.poll.return_value = 0
            return 0
        
        mock_process.poll.side_effect = [None, 0]  # First call returns None, second returns 0
        
        # Test
        calibration_service._monitor_calibration_subprocess(session_id)
        
        # Assertions
        assert mock_select.called
        assert mock_read.called

class TestCalibrationServiceBasicMethods:
    """Test basic service methods"""
    
    @pytest.mark.asyncio
    async def test_is_running_false_for_nonexistent_session(self, calibration_service):
        """Test is_running returns False for non-existent session"""
        result = await calibration_service.is_running('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_is_waiting_for_input_false_for_nonexistent_session(self, calibration_service):
        """Test is_waiting_for_input returns False for non-existent session"""
        result = await calibration_service.is_waiting_for_input('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_all_output_empty_for_nonexistent_session(self, calibration_service):
        """Test get_all_output returns empty list for non-existent session"""
        result = await calibration_service.get_all_output('non_existent')
        assert result == []
    
    @pytest.mark.asyncio
    async def test_stop_calibration_false_for_nonexistent_session(self, calibration_service):
        """Test stop_calibration returns False for non-existent session"""
        result = await calibration_service.stop_calibration('non_existent')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_send_input_false_for_nonexistent_session(self, calibration_service):
        """Test send_input returns False for non-existent session"""
        result = await calibration_service.send_input('non_existent', 'test input')
        assert result is False

class TestCalibrationServiceFileMethods:
    """Test file checking methods"""
    
    @pytest.mark.asyncio
    async def test_check_calibration_files_basic(self, calibration_service):
        """Test checking calibration files returns expected structure"""
        result = await calibration_service.check_calibration_files('test_robot', 'follower')
        assert isinstance(result, dict)
        assert 'robot_id' in result
        assert result['robot_id'] == 'test_robot'
    
    @pytest.mark.asyncio
    async def test_list_ports_basic(self, calibration_service):
        """Test listing ports returns expected structure"""
        result = await calibration_service.list_ports()
        assert isinstance(result, dict)
        assert 'ports' in result
        assert isinstance(result['ports'], list)

class TestCalibrationServiceInternalMethods:
    """Test internal helper methods"""
    
    def test_add_output_to_nonexistent_session(self, calibration_service):
        """Test adding output to non-existent session doesn't crash"""
        # Should not raise exception
        calibration_service._add_output('non_existent', 'Test message')
    
    def test_add_output_to_existing_session(self, calibration_service):
        """Test adding output to existing session"""
        session_id = 'test_session'
        calibration_service.active_sessions[session_id] = {'output': []}
        
        calibration_service._add_output(session_id, 'Test message')
        
        assert 'Test message' in calibration_service.active_sessions[session_id]['output'] 