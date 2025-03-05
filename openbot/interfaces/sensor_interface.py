# interfaces/sensor_interface.py
from abc import ABC, abstractmethod

class Sensor(ABC):
    @abstractmethod
    def start(self):
        """Start the sensor device."""
        pass

    @abstractmethod
    def stop(self):
        """Stop the sensor device."""
        pass

    @abstractmethod
    def get_latest_frame(self):
        """Retrieve the most recent data/frame from the sensor.
        
        Returns:
            The latest sensor data (e.g., a frame for a camera) or None if not available.
        """
        pass
