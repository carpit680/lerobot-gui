# openbot/interfaces/comm_interface.py
from abc import ABC, abstractmethod

class CommInterface(ABC):
    @abstractmethod
    async def setup_connection(self):
        """
        Set up the communication connection.
        """
        pass

    @abstractmethod
    async def send(self, message):
        """
        Send a message over the communication channel.
        
        Args:
            message: The message to be sent.
        """
        pass

    @abstractmethod
    def set_on_message(self, callback):
        """
        Register a callback to handle incoming messages.
        
        Args:
            callback (function): A function that accepts one argument (the incoming message).
        """
        pass

    @abstractmethod
    async def close(self):
        """
        Close the communication connection.
        """
        pass
