import asyncio
import socket
import grpc
import pytest
import pytest_asyncio

from openbot.interfaces.comm_interface import CommInterface
from openbot.comm.webrtc_adapter import WebRTCAdapter
from openbot.comm.grpc_adapter import GRPCAdapter
from openbot.comm.proto import comm_pb2, comm_pb2_grpc

#############################
# WebRTC Adapter Tests
#############################

# Dummy signaling implementation using asyncio queues for WebRTC.
class DummySignaling:
    """
    A dummy signaling implementation using asyncio queues.
    """
    def __init__(self, send_queue, receive_queue):
        self.send_queue = send_queue
        self.receive_queue = receive_queue

    async def send(self, message):
        await self.send_queue.put(message)

    async def receive(self):
        return await self.receive_queue.get()

class DummySignalingPair:
    """
    Creates a pair of dummy signaling channels for two peers.
    """
    def __init__(self):
        self.queue_offer = asyncio.Queue()
        self.queue_answer = asyncio.Queue()

    def get_offer_signaling(self):
        return DummySignaling(self.queue_offer, self.queue_answer)

    def get_answer_signaling(self):
        return DummySignaling(self.queue_answer, self.queue_offer)

@pytest.mark.asyncio
async def test_comm_interface_compliance_webrtc():
    """
    Test that the WebRTCAdapter correctly implements the CommInterface.
    """
    signaling_pair = DummySignalingPair()
    offer_signaling = signaling_pair.get_offer_signaling()
    adapter = WebRTCAdapter(role="offer", signaling=offer_signaling)
    assert isinstance(adapter, CommInterface), "WebRTCAdapter does not implement CommInterface."
    await adapter.close()

@pytest.mark.asyncio
async def test_webrtc_connection_and_message_exchange():
    """
    Test that two WebRTCAdapter instances (offer and answer) can set up a connection and exchange messages.
    """
    signaling_pair = DummySignalingPair()
    offer_signaling = signaling_pair.get_offer_signaling()
    answer_signaling = signaling_pair.get_answer_signaling()

    offer_adapter = WebRTCAdapter(role="offer", signaling=offer_signaling)
    answer_adapter = WebRTCAdapter(role="answer", signaling=answer_signaling)

    received_messages_answer = []
    def on_answer_message(msg):
        received_messages_answer.append(msg)
    answer_adapter.set_on_message(on_answer_message)

    await asyncio.gather(
        offer_adapter.setup_connection(),
        answer_adapter.setup_connection()
    )
    await asyncio.sleep(0.5)

    test_message = "Hello from offer"
    await offer_adapter.send(test_message)
    await asyncio.sleep(0.2)
    assert test_message in received_messages_answer, "Answer did not receive message from offer."

    received_messages_offer = []
    def on_offer_message(msg):
        received_messages_offer.append(msg)
    offer_adapter.set_on_message(on_offer_message)
    reply_message = "Hello from answer"
    await answer_adapter.send(reply_message)
    await asyncio.sleep(0.2)
    assert reply_message in received_messages_offer, "Offer did not receive message from answer."

    await asyncio.gather(
        offer_adapter.close(),
        answer_adapter.close()
    )

#############################
# gRPC Adapter Tests
#############################

# Dummy gRPC service implementation for testing.
class DummyCommService(comm_pb2_grpc.CommServiceServicer):
    """
    A dummy implementation of the CommService for testing.
    It records messages received via SendMessage and streams messages via Connect.
    """
    def __init__(self):
        self.received_messages = []
        self.outgoing_messages = asyncio.Queue()

    async def Connect(self, request, context):
        """
        Stream messages from the outgoing_messages queue.
        """
        while True:
            try:
                msg = await asyncio.wait_for(self.outgoing_messages.get(), timeout=5)
                yield comm_pb2.ConnectResponse(message=msg)
            except asyncio.TimeoutError:
                break

    async def SendMessage(self, request, context):
        self.received_messages.append(request.message)
        return comm_pb2.SendMessageResponse()

def find_free_port():
    """
    Helper function to find a free port.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 0))
    addr, port = s.getsockname()
    s.close()
    return port

@pytest_asyncio.fixture
async def grpc_test_server():
    """
    Starts a dummy gRPC server with DummyCommService on a free port.
    Yields (dummy_service, server_address) and stops the server after tests.
    """
    port = find_free_port()
    server = grpc.aio.server()
    dummy_service = DummyCommService()
    comm_pb2_grpc.add_CommServiceServicer_to_server(dummy_service, server)
    server_address = f"localhost:{port}"
    server.add_insecure_port(server_address)
    await server.start()
    yield dummy_service, server_address
    await server.stop(0)

@pytest.mark.asyncio
async def test_grpc_adapter_interface_compliance(grpc_test_server):
    """
    Test that GRPCAdapter correctly implements the CommInterface.
    """
    _, server_address = grpc_test_server
    adapter = GRPCAdapter(server_address=server_address)
    assert isinstance(adapter, CommInterface), "GRPCAdapter does not implement CommInterface."
    await adapter.close()

@pytest.mark.asyncio
async def test_grpc_adapter_connection_and_message_exchange(grpc_test_server):
    """
    Test that GRPCAdapter can set up a connection, receive a message from the server,
    and send a message that the server records.
    """
    dummy_service, server_address = grpc_test_server

    # Preload a message into the server's outgoing queue.
    await dummy_service.outgoing_messages.put("hello from server")

    adapter = GRPCAdapter(server_address=server_address)
    received_messages = []
    adapter.set_on_message(lambda msg: received_messages.append(msg))
    await adapter.setup_connection()
    await asyncio.sleep(1)  # Allow time for streaming messages
    assert "hello from server" in received_messages, "Did not receive message from server via gRPC adapter."

    test_message = "hello from client"
    await adapter.send(test_message)
    await asyncio.sleep(0.5)
    assert test_message in dummy_service.received_messages, "Server did not record the sent message via gRPC adapter."

    await adapter.close()
