#!/usr/bin/env python
import asyncio
import socket
import grpc

from openbot.comm.proto import comm_pb2, comm_pb2_grpc
from openbot.comm.grpc_adapter import GRPCAdapter

# --- Dummy gRPC Service Implementation --- #
class DummyCommService(comm_pb2_grpc.CommServiceServicer):
    """
    A simple dummy gRPC service that streams messages and echoes received messages.
    """
    def __init__(self):
        self.outgoing_messages = asyncio.Queue()
        self.received_messages = []

    async def Connect(self, request, context):
        """
        Stream messages from the outgoing_messages queue until timeout.
        """
        while True:
            try:
                # Wait up to 5 seconds for a new message
                msg = await asyncio.wait_for(self.outgoing_messages.get(), timeout=5)
                yield comm_pb2.ConnectResponse(message=msg)
            except asyncio.TimeoutError:
                break

    async def SendMessage(self, request, context):
        """
        Record the incoming message and echo it back by adding it to the outgoing queue.
        """
        self.received_messages.append(request.message)
        echo_msg = f"Echo: {request.message}"
        await self.outgoing_messages.put(echo_msg)
        return comm_pb2.SendMessageResponse()

# --- Helper to Find a Free Port --- #
def find_free_port():
    """
    Return a free port on localhost.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 0))
    _, port = s.getsockname()
    s.close()
    return port

# --- Function to Start the gRPC Server --- #
async def start_grpc_server():
    """
    Start a gRPC server with the DummyCommService on a free port.
    Returns a tuple (server, dummy_service, server_address).
    """
    port = find_free_port()
    server_address = f"localhost:{port}"
    server = grpc.aio.server()
    dummy_service = DummyCommService()
    comm_pb2_grpc.add_CommServiceServicer_to_server(dummy_service, server)
    server.add_insecure_port(server_address)
    await server.start()
    print(f"gRPC server started on {server_address}")
    return server, dummy_service, server_address

# --- Main Communication Demo --- #
async def main():
    # Start the gRPC server.
    server, dummy_service, server_address = await start_grpc_server()

    # Create a GRPCAdapter client pointing to the server.
    adapter = GRPCAdapter(server_address=server_address)

    # Set a message handler to print any incoming messages.
    def on_message(message):
        print(f"Received from server: {message}")
    adapter.set_on_message(on_message)

    # Establish the connection (this starts the streaming RPC).
    print("Setting up connection from client...")
    await adapter.setup_connection()

    # Wait a short while to allow the connection to be established.
    await asyncio.sleep(1)

    # Send a message from the client.
    client_message = "Hello from client"
    print(f"Client sending: {client_message}")
    await adapter.send(client_message)

    # Wait to receive the echo from the server.
    await asyncio.sleep(2)

    # Optionally, send another message.
    client_message2 = "Another message"
    print(f"Client sending: {client_message2}")
    await adapter.send(client_message2)
    await asyncio.sleep(2)

    # Close the adapter and shutdown the server.
    print("Closing client connection...")
    await adapter.close()
    print("Shutting down server...")
    try:
        await server.stop(0)
    except asyncio.CancelledError:
        pass
    print("Server shut down.")


if __name__ == "__main__":
    asyncio.run(main())
