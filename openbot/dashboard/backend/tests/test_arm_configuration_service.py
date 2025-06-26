import pytest
import json
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock
from backend.arm_configuration_service import (
    ArmConfigurationService,
    RobotConfig,
    ArmConfiguration,
    arm_configuration_service
)

class TestRobotConfig:
    def test_robot_config_creation(self):
        """Test creating a RobotConfig instance"""
        config = RobotConfig(
            port="/dev/ttyUSB0",
            robot_type="so100",
            robot_id="test_robot",
            connected=True
        )
        
        assert config.port == "/dev/ttyUSB0"
        assert config.robot_type == "so100"
        assert config.robot_id == "test_robot"
        assert config.connected is True

    def test_robot_config_defaults(self):
        """Test RobotConfig with default values"""
        config = RobotConfig(
            port="/dev/ttyUSB0",
            robot_type="so100",
            robot_id="test_robot"
        )
        
        assert config.connected is False

class TestArmConfiguration:
    def test_arm_configuration_creation(self):
        """Test creating an ArmConfiguration instance"""
        leader = RobotConfig(port="/dev/ttyUSB0", robot_type="so100", robot_id="leader")
        follower = RobotConfig(port="/dev/ttyUSB1", robot_type="giraffe", robot_id="follower")
        
        config = ArmConfiguration(leader=leader, follower=follower)
        
        assert config.leader.port == "/dev/ttyUSB0"
        assert config.leader.robot_type == "so100"
        assert config.follower.port == "/dev/ttyUSB1"
        assert config.follower.robot_type == "giraffe"

class TestArmConfigurationService:
    @pytest.fixture
    def temp_config_file(self):
        """Create a temporary config file for testing"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            yield Path(f.name)
        os.unlink(f.name)

    @pytest.fixture
    def service_with_temp_file(self, temp_config_file):
        """Create service instance with temporary config file"""
        service = ArmConfigurationService()
        service.config_file = temp_config_file
        return service

    def test_service_initialization(self, service_with_temp_file):
        """Test service initialization with empty config"""
        service = service_with_temp_file
        assert service.config is not None
        assert service.config.leader.port == ""
        assert service.config.follower.port == ""

    def test_load_existing_config(self, temp_config_file):
        """Test loading existing configuration from file"""
        config_data = {
            "leader": {
                "port": "/dev/ttyUSB0",
                "robot_type": "so100",
                "robot_id": "leader_arm",
                "connected": True
            },
            "follower": {
                "port": "/dev/ttyUSB1",
                "robot_type": "giraffe",
                "robot_id": "follower_arm",
                "connected": False
            }
        }
        
        with open(temp_config_file, 'w') as f:
            json.dump(config_data, f)
        
        service = ArmConfigurationService()
        service.config_file = temp_config_file
        service.load_config()
        
        assert service.config.leader.port == "/dev/ttyUSB0"
        assert service.config.leader.robot_type == "so100"
        assert service.config.leader.robot_id == "leader_arm"
        assert service.config.leader.connected is True
        assert service.config.follower.port == "/dev/ttyUSB1"
        assert service.config.follower.robot_type == "giraffe"
        assert service.config.follower.robot_id == "follower_arm"
        assert service.config.follower.connected is False

    def test_save_config(self, service_with_temp_file):
        """Test saving configuration to file"""
        service = service_with_temp_file
        
        # Update configuration
        service.config.leader.port = "/dev/ttyUSB0"
        service.config.leader.robot_type = "so100"
        service.config.leader.robot_id = "test_leader"
        
        # Save configuration
        success = service.save_config()
        assert success is True
        
        # Verify file was created and contains correct data
        assert service.config_file.exists()
        with open(service.config_file, 'r') as f:
            saved_data = json.load(f)
        
        assert saved_data["leader"]["port"] == "/dev/ttyUSB0"
        assert saved_data["leader"]["robot_type"] == "so100"
        assert saved_data["leader"]["robot_id"] == "test_leader"

    def test_update_leader_config(self, service_with_temp_file):
        """Test updating leader arm configuration"""
        service = service_with_temp_file
        
        success = service.update_leader_config(
            port="/dev/ttyUSB0",
            robot_type="so100",
            robot_id="leader_arm"
        )
        
        assert success is True
        assert service.config.leader.port == "/dev/ttyUSB0"
        assert service.config.leader.robot_type == "so100"
        assert service.config.leader.robot_id == "leader_arm"

    def test_update_follower_config(self, service_with_temp_file):
        """Test updating follower arm configuration"""
        service = service_with_temp_file
        
        success = service.update_follower_config(
            port="/dev/ttyUSB1",
            robot_type="giraffe",
            robot_id="follower_arm"
        )
        
        assert success is True
        assert service.config.follower.port == "/dev/ttyUSB1"
        assert service.config.follower.robot_type == "giraffe"
        assert service.config.follower.robot_id == "follower_arm"

    def test_get_config(self, service_with_temp_file):
        """Test getting current configuration"""
        service = service_with_temp_file
        
        config = service.get_config()
        assert config is not None
        assert isinstance(config, ArmConfiguration)

    def test_get_leader_config(self, service_with_temp_file):
        """Test getting leader arm configuration"""
        service = service_with_temp_file
        
        # Set some configuration
        service.config.leader.port = "/dev/ttyUSB0"
        service.config.leader.robot_type = "so100"
        
        leader_config = service.get_leader_config()
        assert leader_config is not None
        assert leader_config.port == "/dev/ttyUSB0"
        assert leader_config.robot_type == "so100"

    def test_get_follower_config(self, service_with_temp_file):
        """Test getting follower arm configuration"""
        service = service_with_temp_file
        
        # Set some configuration
        service.config.follower.port = "/dev/ttyUSB1"
        service.config.follower.robot_type = "giraffe"
        
        follower_config = service.get_follower_config()
        assert follower_config is not None
        assert follower_config.port == "/dev/ttyUSB1"
        assert follower_config.robot_type == "giraffe"

    @pytest.mark.asyncio
    async def test_list_ports(self, service_with_temp_file):
        """Test listing available USB ports with filtering"""
        service = service_with_temp_file
        
        with patch('serial.tools.list_ports.comports') as mock_comports:
            # Create mock ports including both USB and non-USB devices
            mock_port1 = MagicMock()
            mock_port1.device = "/dev/ttyUSB0"
            mock_port1.description = "USB Serial Device"
            mock_port1.manufacturer = "FTDI"
            mock_port1.product = "USB Serial"
            
            mock_port2 = MagicMock()
            mock_port2.device = "/dev/ttyACM0"
            mock_port2.description = "Arduino Uno"
            mock_port2.manufacturer = "Arduino"
            mock_port2.product = "Uno"
            
            mock_port3 = MagicMock()
            mock_port3.device = "/dev/ttyS0"
            mock_port3.description = "Built-in Serial Port"
            mock_port3.manufacturer = "System"
            mock_port3.product = "Serial"
            
            mock_comports.return_value = [mock_port1, mock_port2, mock_port3]
            
            ports = await service.list_ports()
            
            # Should only return USB devices (ttyUSB0 and ttyACM0)
            assert len(ports) == 2
            assert ports[0]["path"] == "/dev/ttyUSB0"
            assert ports[0]["name"] == "USB Serial Device"
            assert ports[0]["manufacturer"] == "FTDI"
            assert ports[1]["path"] == "/dev/ttyACM0"
            assert ports[1]["name"] == "Arduino Uno"

    def test_is_usb_device_linux(self, service_with_temp_file):
        """Test USB device detection on Linux"""
        service = service_with_temp_file
        
        # Test Linux USB device patterns
        mock_port1 = MagicMock()
        mock_port1.device = "/dev/ttyUSB0"
        mock_port1.manufacturer = None
        mock_port1.product = None
        assert service._is_usb_device(mock_port1) is True
        
        mock_port2 = MagicMock()
        mock_port2.device = "/dev/ttyACM0"
        mock_port2.manufacturer = None
        mock_port2.product = None
        assert service._is_usb_device(mock_port2) is True
        
        # Test non-USB device
        mock_port3 = MagicMock()
        mock_port3.device = "/dev/ttyS0"
        mock_port3.manufacturer = None
        mock_port3.product = None
        assert service._is_usb_device(mock_port3) is False

    def test_is_usb_device_macos(self, service_with_temp_file):
        """Test USB device detection on macOS"""
        service = service_with_temp_file
        
        # Test macOS USB device patterns
        mock_port1 = MagicMock()
        mock_port1.device = "/dev/tty.usbserial-12345"
        mock_port1.manufacturer = None
        mock_port1.product = None
        assert service._is_usb_device(mock_port1) is True
        
        mock_port2 = MagicMock()
        mock_port2.device = "/dev/tty.usbmodem12345"
        mock_port2.manufacturer = None
        mock_port2.product = None
        assert service._is_usb_device(mock_port2) is True

    def test_is_usb_device_by_manufacturer(self, service_with_temp_file):
        """Test USB device detection by manufacturer/product"""
        service = service_with_temp_file
        
        # Test by manufacturer
        mock_port1 = MagicMock()
        mock_port1.device = "/dev/ttyXYZ0"
        mock_port1.manufacturer = "FTDI"
        mock_port1.product = None
        assert service._is_usb_device(mock_port1) is True
        
        # Test by product
        mock_port2 = MagicMock()
        mock_port2.device = "/dev/ttyXYZ1"
        mock_port2.manufacturer = None
        mock_port2.product = "Arduino Uno"
        assert service._is_usb_device(mock_port2) is True
        
        # Test by device name containing USB
        mock_port3 = MagicMock()
        mock_port3.device = "/dev/ttyUSBserial0"
        mock_port3.manufacturer = None
        mock_port3.product = None
        assert service._is_usb_device(mock_port3) is True

    def test_validate_config_valid(self, service_with_temp_file):
        """Test configuration validation with valid config"""
        service = service_with_temp_file
        
        # Set valid configuration
        service.config.leader.port = "/dev/ttyUSB0"
        service.config.leader.robot_type = "so100"
        service.config.leader.robot_id = "leader_arm"
        service.config.follower.port = "/dev/ttyUSB1"
        service.config.follower.robot_type = "giraffe"
        service.config.follower.robot_id = "follower_arm"
        
        with patch.object(service, 'list_ports') as mock_list_ports:
            mock_list_ports.return_value = [
                {"path": "/dev/ttyUSB0"},
                {"path": "/dev/ttyUSB1"}
            ]
            
            result = service.validate_config()
            
            assert result["valid"] is True
            assert len(result["errors"]) == 0
            assert "config" in result

    def test_validate_config_invalid(self, service_with_temp_file):
        """Test configuration validation with invalid config"""
        service = service_with_temp_file
        
        # Leave configuration empty (invalid)
        result = service.validate_config()
        
        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert "Leader arm port not configured" in result["errors"]
        assert "Follower arm port not configured" in result["errors"]

    def test_validate_config_duplicate_ports(self, service_with_temp_file):
        """Test configuration validation with duplicate ports"""
        service = service_with_temp_file
        
        # Set configuration with duplicate ports
        service.config.leader.port = "/dev/ttyUSB0"
        service.config.leader.robot_type = "so100"
        service.config.leader.robot_id = "leader_arm"
        service.config.follower.port = "/dev/ttyUSB0"  # Same port
        service.config.follower.robot_type = "giraffe"
        service.config.follower.robot_id = "follower_arm"
        
        result = service.validate_config()
        
        assert result["valid"] is False
        assert "Leader and follower arms cannot use the same port" in result["errors"]

    def test_validate_config_duplicate_ids(self, service_with_temp_file):
        """Test configuration validation with duplicate robot IDs"""
        service = service_with_temp_file
        
        # Set configuration with duplicate robot IDs
        service.config.leader.port = "/dev/ttyUSB0"
        service.config.leader.robot_type = "so100"
        service.config.leader.robot_id = "same_id"
        service.config.follower.port = "/dev/ttyUSB1"
        service.config.follower.robot_type = "giraffe"
        service.config.follower.robot_id = "same_id"  # Same ID
        
        result = service.validate_config()
        
        assert result["valid"] is False
        assert "Leader and follower arms cannot have the same robot ID" in result["errors"]

    def test_reset_config(self, service_with_temp_file):
        """Test resetting configuration to defaults"""
        service = service_with_temp_file
        
        # Set some configuration
        service.config.leader.port = "/dev/ttyUSB0"
        service.config.leader.robot_type = "so100"
        service.config.leader.robot_id = "leader_arm"
        
        # Reset configuration
        success = service.reset_config()
        
        assert success is True
        assert service.config.leader.port == ""
        assert service.config.leader.robot_type == ""
        assert service.config.leader.robot_id == ""
        assert service.config.follower.port == ""
        assert service.config.follower.robot_type == ""
        assert service.config.follower.robot_id == ""

class TestGlobalService:
    def test_global_service_instance(self):
        """Test that the global service instance is created correctly"""
        assert arm_configuration_service is not None
        assert isinstance(arm_configuration_service, ArmConfigurationService)
        assert arm_configuration_service.config is not None 