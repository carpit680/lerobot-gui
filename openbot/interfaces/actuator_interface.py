# interfaces/sensor_interface.py
from abc import ABC, abstractmethod

class Actuator(ABC):
    @abstractmethod
    def connect(self):
        """Start the sensor device."""
        pass

    @abstractmethod
    def disconnect(self):
        """Stop the sensor device."""
        pass

    @abstractmethod
    def write(self):
        """Retrieve the most recent data/frame from the sensor.
        
        Returns:
            The latest sensor data (e.g., a frame for a camera) or None if not available.
        """
        pass
