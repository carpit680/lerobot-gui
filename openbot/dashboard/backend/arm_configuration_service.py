import json
import os
import asyncio
import logging
from typing import Dict, Optional, List
from pydantic import BaseModel
import serial.tools.list_ports
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RobotConfig(BaseModel):
    """Robot configuration model"""
    port: str
    robot_type: str
    robot_id: str
    connected: bool = False

class ArmConfiguration(BaseModel):
    """Complete arm configuration model"""
    leader: RobotConfig
    follower: RobotConfig

class ArmConfigurationService:
    """Service for managing arm configuration"""
    
    def __init__(self):
        self.config_file = Path("arm_config.json")
        self.config: Optional[ArmConfiguration] = None
        self.load_config()
    
    def load_config(self) -> None:
        """Load configuration from file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config_data = json.load(f)
                    self.config = ArmConfiguration(**config_data)
                    logger.info("Arm configuration loaded from file")
            else:
                # Initialize with default empty configuration
                self.config = ArmConfiguration(
                    leader=RobotConfig(port="", robot_type="", robot_id=""),
                    follower=RobotConfig(port="", robot_type="", robot_id="")
                )
                logger.info("Initialized with default arm configuration")
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            # Initialize with default configuration on error
            self.config = ArmConfiguration(
                leader=RobotConfig(port="", robot_type="", robot_id=""),
                follower=RobotConfig(port="", robot_type="", robot_id="")
            )
    
    def save_config(self) -> bool:
        """Save configuration to file"""
        try:
            if self.config:
                with open(self.config_file, 'w') as f:
                    json.dump(self.config.model_dump(), f, indent=2)
                logger.info("Arm configuration saved to file")
                return True
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
        return False
    
    def update_leader_config(self, port: str = None, robot_type: str = None, robot_id: str = None) -> bool:
        """Update leader arm configuration"""
        try:
            if not self.config:
                self.load_config()
            
            if port is not None:
                self.config.leader.port = port
            if robot_type is not None:
                self.config.leader.robot_type = robot_type
            if robot_id is not None:
                self.config.leader.robot_id = robot_id
            
            return self.save_config()
        except Exception as e:
            logger.error(f"Failed to update leader config: {e}")
            return False
    
    def update_follower_config(self, port: str = None, robot_type: str = None, robot_id: str = None) -> bool:
        """Update follower arm configuration"""
        try:
            if not self.config:
                self.load_config()
            
            if port is not None:
                self.config.follower.port = port
            if robot_type is not None:
                self.config.follower.robot_type = robot_type
            if robot_id is not None:
                self.config.follower.robot_id = robot_id
            
            return self.save_config()
        except Exception as e:
            logger.error(f"Failed to update follower config: {e}")
            return False
    
    def get_config(self) -> Optional[ArmConfiguration]:
        """Get current configuration"""
        if not self.config:
            self.load_config()
        return self.config
    
    def get_leader_config(self) -> Optional[RobotConfig]:
        """Get leader arm configuration"""
        config = self.get_config()
        return config.leader if config else None
    
    def get_follower_config(self) -> Optional[RobotConfig]:
        """Get follower arm configuration"""
        config = self.get_config()
        return config.follower if config else None
    
    async def test_connection(self, arm_type: str) -> Dict[str, any]:
        """Test connection to a specific arm"""
        try:
            config = self.get_config()
            if not config:
                return {"success": False, "error": "No configuration found"}
            
            robot_config = config.leader if arm_type == "leader" else config.follower
            
            if not robot_config.port:
                return {"success": False, "error": f"No port configured for {arm_type} arm"}
            
            if not robot_config.robot_type:
                return {"success": False, "error": f"No robot type configured for {arm_type} arm"}
            
            if not robot_config.robot_id:
                return {"success": False, "error": f"No robot ID configured for {arm_type} arm"}
            
            # Test serial port connection
            try:
                # Try to open the serial port
                with serial.Serial(robot_config.port, 115200, timeout=1) as ser:
                    # Send a simple command to test communication
                    ser.write(b"ping\n")
                    response = ser.readline().decode().strip()
                    
                    if response:
                        robot_config.connected = True
                        self.save_config()
                        return {
                            "success": True,
                            "message": f"{arm_type.capitalize()} arm connected successfully",
                            "port": robot_config.port,
                            "robot_type": robot_config.robot_type,
                            "robot_id": robot_config.robot_id,
                            "connected": True
                        }
                    else:
                        robot_config.connected = False
                        self.save_config()
                        return {
                            "success": False,
                            "error": f"No response from {arm_type} arm",
                            "port": robot_config.port,
                            "robot_type": robot_config.robot_type,
                            "robot_id": robot_config.robot_id,
                            "connected": False
                        }
                        
            except serial.SerialException as e:
                robot_config.connected = False
                self.save_config()
                return {
                    "success": False,
                    "error": f"Serial connection failed: {str(e)}",
                    "port": robot_config.port,
                    "robot_type": robot_config.robot_type,
                    "robot_id": robot_config.robot_id,
                    "connected": False
                }
                
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return {"success": False, "error": f"Connection test failed: {str(e)}"}
    
    async def list_ports(self) -> List[Dict[str, str]]:
        """List available USB ports on Mac and Linux systems"""
        try:
            ports = []
            for port in serial.tools.list_ports.comports():
                # Filter for USB devices on Mac and Linux
                if self._is_usb_device(port):
                    ports.append({
                        "path": port.device,
                        "name": port.description or f"USB Device on {port.device}",
                        "manufacturer": port.manufacturer or "Unknown",
                        "product": port.product or "Unknown"
                    })
            return ports
        except Exception as e:
            logger.error(f"Failed to list ports: {e}")
            return []
    
    def _is_usb_device(self, port) -> bool:
        """Check if a port is a USB device on Mac/Linux"""
        try:
            # On Linux, USB devices typically have paths like /dev/ttyUSB* or /dev/ttyACM*
            if port.device.startswith('/dev/ttyUSB') or port.device.startswith('/dev/ttyACM'):
                return True
            
            # On macOS, USB devices typically have paths like /dev/tty.usbserial* or /dev/tty.usbmodem*
            if port.device.startswith('/dev/tty.usbserial') or port.device.startswith('/dev/tty.usbmodem'):
                return True
            
            # Additional USB device patterns - be more specific to avoid false positives
            device_lower = port.device.lower()
            if any(pattern in device_lower for pattern in ['usbserial', 'usbmodem', 'usb-serial', 'usb-modem']):
                return True
            
            # Check if manufacturer or product contains USB-related keywords
            if port.manufacturer and any(keyword in port.manufacturer.lower() for keyword in ['usb', 'ftdi', 'arduino', 'ch340', 'cp210']):
                return True
            
            if port.product and any(keyword in port.product.lower() for keyword in ['usb', 'usb-serial', 'usb-modem', 'arduino']):
                return True
            
            return False
        except Exception as e:
            logger.warning(f"Error checking if port {port.device} is USB: {e}")
            # If we can't determine, include it to be safe
            return True
    
    def validate_config(self) -> Dict[str, any]:
        """Validate current configuration"""
        try:
            config = self.get_config()
            if not config:
                return {"valid": False, "errors": ["No configuration found"]}
            
            errors = []
            warnings = []
            
            # Check leader arm
            if not config.leader.port:
                errors.append("Leader arm port not configured")
            if not config.leader.robot_type:
                errors.append("Leader arm robot type not configured")
            if not config.leader.robot_id:
                errors.append("Leader arm robot ID not configured")
            
            # Check follower arm
            if not config.follower.port:
                errors.append("Follower arm port not configured")
            if not config.follower.robot_type:
                errors.append("Follower arm robot type not configured")
            if not config.follower.robot_id:
                errors.append("Follower arm robot ID not configured")
            
            # Check for duplicate ports
            if (config.leader.port and config.follower.port and 
                config.leader.port == config.follower.port):
                errors.append("Leader and follower arms cannot use the same port")
            
            # Check for duplicate robot IDs
            if (config.leader.robot_id and config.follower.robot_id and 
                config.leader.robot_id == config.follower.robot_id):
                errors.append("Leader and follower arms cannot have the same robot ID")
            
            # Check if ports are available
            available_ports = [port["path"] for port in asyncio.run(self.list_ports())]
            if config.leader.port and config.leader.port not in available_ports:
                warnings.append(f"Leader arm port {config.leader.port} not found in available ports")
            if config.follower.port and config.follower.port not in available_ports:
                warnings.append(f"Follower arm port {config.follower.port} not found in available ports")
            
            return {
                "valid": len(errors) == 0,
                "errors": errors,
                "warnings": warnings,
                "config": config.model_dump() if config else None
            }
            
        except Exception as e:
            logger.error(f"Configuration validation failed: {e}")
            return {"valid": False, "errors": [f"Validation failed: {str(e)}"]}
    
    def reset_config(self) -> bool:
        """Reset configuration to defaults"""
        try:
            self.config = ArmConfiguration(
                leader=RobotConfig(port="", robot_type="", robot_id=""),
                follower=RobotConfig(port="", robot_type="", robot_id="")
            )
            return self.save_config()
        except Exception as e:
            logger.error(f"Failed to reset configuration: {e}")
            return False

# Create global instance
arm_configuration_service = ArmConfigurationService() 