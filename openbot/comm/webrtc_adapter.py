# openbot/comm/webrtc_adapter.py
import asyncio
from aiortc import RTCPeerConnection
from openbot.interfaces.comm_interface import CommInterface

class WebRTCAdapter(CommInterface):
    """
    A WebRTC communication adapter using aiortc.
    Provides methods to set up a peer connection, send messages,
    and receive messages via a registered callback.
    """

    def __init__(self, role, signaling):
        """
        Initialize the adapter.

        Args:
            role (str): Either "offer" or "answer".
            signaling: A signaling object that implements async send() and receive() for SDP exchange.
        """
        if role not in ("offer", "answer"):
            raise ValueError("Role must be either 'offer' or 'answer'.")
        self.role = role
        self.signaling = signaling
        self.pc = RTCPeerConnection()
        self.channel = None
        self.on_message_handler = None

    async def setup_connection(self):
        """
        Set up the WebRTC connection by exchanging SDP offers/answers with the remote peer.
        """
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
