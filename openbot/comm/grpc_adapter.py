import asyncio
import grpc
from openbot.interfaces.comm_interface import CommInterface
from openbot.comm.proto import comm_pb2, comm_pb2_grpc

class GRPCAdapter(CommInterface):
    """
    A gRPC communication adapter that implements the CommInterface.
    
    This adapter uses gRPC's asyncio support to establish a connection with a remote peer,
    send messages, receive messages via a streaming RPC, and close the connection.
    
    The gRPC service is assumed to have the following RPC methods defined in your .proto file:
      - Connect(ConnectRequest) returns (stream ConnectResponse)
      - SendMessage(SendMessageRequest) returns (SendMessageResponse)
    
    You will need to define these in your .proto file and generate the corresponding Python files.
    """
    def __init__(self, server_address: str):
        """
        Initialize the GRPCAdapter.
        
        Args:
            server_address (str): The address of the gRPC server (e.g., "localhost:50051").
        """
        self.server_address = server_address
        self.channel = grpc.aio.insecure_channel(server_address)
        self.stub = comm_pb2_grpc.CommServiceStub(self.channel)
        self.on_message_handler = None
        self._receive_task = None

    async def setup_connection(self):
        """
        Set up the gRPC connection by starting the message receiver task.
        
        This method calls the Connect RPC to establish a streaming connection to receive messages.
        """
        self._receive_task = asyncio.create_task(self._receive_messages())

    async def _receive_messages(self):
        """
        Internal method to receive messages from the server.
        
        This method awaits messages from the streaming Connect RPC.
        """
        async for response in self.stub.Connect(comm_pb2.ConnectRequest()):
            if self.on_message_handler:
                self.on_message_handler(response.message)

    def set_on_message(self, callback):
        """
        Register a callback to handle incoming messages.
        
        Args:
            callback (function): A function that accepts one argument (the message).
        """
        self.on_message_handler = callback

    async def send(self, message):
        """
        Send a message to the server via the SendMessage RPC.
        
        Args:
            message (str): The message to send.
        """
        request = comm_pb2.SendMessageRequest(message=message)
        await self.stub.SendMessage(request)

    async def close(self):
        """
        Close the gRPC connection and cancel the receiver task.
        """
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        await self.channel.close()
