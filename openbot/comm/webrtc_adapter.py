import asyncio
import json
from aiortc import RTCPeerConnection, RTCSessionDescription
from openbot.interfaces.comm_interface import CommInterface

async def wait_for_channel_open(adapter, timeout=5.0):
    """
    Wait until the data channel is open or the timeout is reached.

    Args:
        timeout (float): Maximum number of seconds to wait.
    Returns:
        bool: True if the channel opens, False if the timeout is reached.
    """
    waited = 0.0
    interval = 0.1
    while waited < timeout:
        if adapter.channel is not None and adapter.channel.readyState == "open":
            return True
        await asyncio.sleep(interval)
        waited += interval
    return False

class TcpSignaling:
    """
    A simple TCP signaling implementation.
    This class handles JSON message send/receive over a TCP connection.
    """
    def __init__(self, reader, writer):
        self.reader = reader
        self.writer = writer

    async def send(self, message):
        # If the message is an RTCSessionDescription, convert it to a dict.
        if isinstance(message, RTCSessionDescription):
            message = {"type": message.type, "sdp": message.sdp}
        data = json.dumps(message) + "\n"
        self.writer.write(data.encode())
        await self.writer.drain()

    async def receive(self):
        data = await self.reader.readline()
        if not data:
            return None
        obj = json.loads(data.decode())
        if isinstance(obj, dict) and "type" in obj and "sdp" in obj:
            obj = RTCSessionDescription(sdp=obj["sdp"], type=obj["type"])
        return obj

    async def close(self):
        self.writer.close()
        await self.writer.wait_closed()

class WebRTCAdapter(CommInterface):
    """
    A WebRTC communication adapter using aiortc.
    Provides methods to set up a peer connection, send messages,
    and receive messages via a registered callback.
    
    If no external signaling object is provided, the adapter will create a TCP
    signaling connection automatically using the provided signaling_host and signaling_port.
    In server_mode, it will start its own TCP signaling server and wait for an incoming connection.
    """
    def __init__(self, role, signaling=None, signaling_host="localhost", signaling_port=12345, server_mode=False):
        """
        Initialize the adapter.

        Args:
            role (str): Either "offer" or "answer".
            signaling: Optional signaling object implementing async send() and receive().
            signaling_host (str): Host to use for TCP signaling if no signaling object is provided.
            signaling_port (int): Port to use for TCP signaling if no signaling object is provided.
            server_mode (bool): If True, the adapter will start a TCP signaling server and wait for a connection.
        """
        if role not in ("offer", "answer"):
            raise ValueError("Role must be either 'offer' or 'answer'.")
        self.role = role
        self.signaling = signaling
        self.signaling_host = signaling_host
        self.signaling_port = signaling_port
        self.server_mode = server_mode
        self.pc = RTCPeerConnection()
        self.channel = None
        self.on_message_handler = None

        # For server mode, use an event to wait for an incoming connection.
        if self.server_mode:
            self._connection_event = asyncio.Event()
            self._server_signaling = None
            self._server = None

    async def _connect_signaling(self):
        """
        Establish a TCP signaling connection.
        If server_mode is True, start a TCP signaling server and wait for a connection.
        Otherwise, connect as a client.
        """
        if self.server_mode:
            print(f"WebRTCAdapter ({self.role}): Starting TCP signaling server at {self.signaling_host}:{self.signaling_port}...")
            self._server = await asyncio.start_server(self._handle_server_connection, self.signaling_host, self.signaling_port)
            print(f"WebRTCAdapter ({self.role}): Waiting for incoming signaling connection...")
            await self._connection_event.wait()
            print(f"WebRTCAdapter ({self.role}): Received signaling connection from remote peer.")
            return self._server_signaling
        else:
            print(f"WebRTCAdapter ({self.role}): Connecting to signaling server at {self.signaling_host}:{self.signaling_port}...")
            reader, writer = await asyncio.open_connection(self.signaling_host, self.signaling_port)
            print(f"WebRTCAdapter ({self.role}): Connected to signaling server.")
            return TcpSignaling(reader, writer)

    async def _handle_server_connection(self, reader, writer):
        """
        Handler for incoming TCP connections when running in server_mode.
        """
        self._server_signaling = TcpSignaling(reader, writer)
        self._connection_event.set()

    async def setup_connection(self):
        """
        Set up the WebRTC connection by exchanging SDP offers/answers with the remote peer.
        If no signaling object was provided, a connection is established automatically.
        """
        if self.signaling is None:
            self.signaling = await self._connect_signaling()

        if self.role == "offer":
            # Create data channel and assign event handlers.
            self.channel = self.pc.createDataChannel("data")
            self.channel.on("open", self._on_channel_open)
            self.channel.on("message", self._on_channel_message)

            # Create and send offer.
            offer = await self.pc.createOffer()
            await self.pc.setLocalDescription(offer)
            await self.signaling.send(self.pc.localDescription)

            # Receive answer and set as remote description.
            answer = await self.signaling.receive()
            await self.pc.setRemoteDescription(answer)
        elif self.role == "answer":
            # Set up event handler for receiving data channel.
            @self.pc.on("datachannel")
            def on_datachannel(channel):
                self.channel = channel
                self.channel.on("open", self._on_channel_open)
                self.channel.on("message", self._on_channel_message)

            # Receive offer, create answer, and send it.
            offer = await self.signaling.receive()
            await self.pc.setRemoteDescription(offer)
            answer = await self.pc.createAnswer()
            await self.pc.setLocalDescription(answer)
            await self.signaling.send(self.pc.localDescription)

    def _on_channel_open(self):
        """
        Internal handler called when the data channel is open.
        """
        print("WebRTC data channel is open.")

    def _on_channel_message(self, message):
        """
        Internal handler called when a message is received on the data channel.
        """
        if self.on_message_handler:
            self.on_message_handler(message)

    def set_on_message(self, callback):
        """
        Register a callback to handle incoming messages.

        Args:
            callback (function): A function that accepts one argument (the message).
        """
        self.on_message_handler = callback

    async def send(self, message):
        """
        Send a message over the data channel.

        Args:
            message: The message to send.
        Raises:
            RuntimeError: If the data channel is not open.
        """
        if self.channel and self.channel.readyState == "open":
            self.channel.send(message)
        else:
            raise RuntimeError("Data channel is not open.")

    async def close(self):
        """
        Close the WebRTC connection.
        """
        await self.pc.close()
        if self.signaling:
            await self.signaling.close()
        if self.server_mode and self._server:
            self._server.close()
            await self._server.wait_closed()
