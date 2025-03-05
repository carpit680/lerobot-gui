#!/usr/bin/env python
import asyncio
import base64
import json
import cv2
import numpy as np
from aiortc import RTCSessionDescription

from openbot.comm.webrtc_adapter import WebRTCAdapter

# Unified TCP Signaling class used by both sender and responder.
class TcpSignaling:
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
        # Convert dict to RTCSessionDescription if applicable.
        if isinstance(obj, dict) and "type" in obj and "sdp" in obj:
            obj = RTCSessionDescription(sdp=obj["sdp"], type=obj["type"])
        return obj

# Run a TCP signaling server that waits for one connection.
async def run_signaling_server(host='localhost', port=12345):
    server = await asyncio.start_server(handle_connection, host, port)
    print(f"Signaling server started on {host}:{port}")
    return server

# Global queue to store the accepted connection.
_signaling_conn = asyncio.Queue()

async def handle_connection(reader, writer):
    await _signaling_conn.put((reader, writer))
    # Keep connection open indefinitely.
    await asyncio.Event().wait()

async def get_signaling_connection():
    # Wait until a connection is accepted.
    reader, writer = await _signaling_conn.get()
    return TcpSignaling(reader, writer)

async def wait_for_channel_open(adapter, timeout=5.0):
    """Wait until the data channel is open or timeout is reached."""
    waited = 0
    interval = 0.1
    while waited < timeout:
        if adapter.channel is not None and adapter.channel.readyState == "open":
            return True
        await asyncio.sleep(interval)
        waited += interval
    return False

async def sender_main():
    # Start the TCP signaling server.
    signaling_server = await run_signaling_server()

    print("Sender: Waiting for responder to connect for signaling...")
    signaling = await get_signaling_connection()
    print("Sender: Responder connected for signaling.")

    # Create a WebRTC adapter with role "offer" using TCP signaling.
    webrtc_adapter = WebRTCAdapter(role="offer", signaling=signaling)
    try:
        await webrtc_adapter.setup_connection()
    except Exception as e:
        print("Sender: Error during setup_connection:", e)
        print("Please ensure the responder script is running and sending an answer.")
        signaling.writer.close()
        await signaling.writer.wait_closed()
        signaling_server.close()
        await signaling_server.wait_closed()
        return

    # Wait until the data channel is open.
    if not await wait_for_channel_open(webrtc_adapter):
        print("Sender: Data channel did not open in time.")
        await webrtc_adapter.close()
        signaling.writer.close()
        await signaling.writer.wait_closed()
        signaling_server.close()
        await signaling_server.wait_closed()
        return

    # Now that the channel is open, send sensor data.
    sensor_data = "Sensor reading: 42.0"
    print("Sender: Sending sensor data:", sensor_data)
    await webrtc_adapter.send(sensor_data)

    # Set up a future to wait for the image response.
    future = asyncio.Future()
    def on_message(msg):
        if not future.done():
            future.set_result(msg)
    webrtc_adapter.set_on_message(on_message)
    print("Sender: Waiting for image response...")
    response = await future

    # Decode the received Base64 JPEG image.
    try:
        jpg_bytes = base64.b64decode(response)
        image = cv2.imdecode(np.frombuffer(jpg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is not None:
            cv2.imshow("Received Image", image)
            cv2.waitKey(2000)
            cv2.destroyAllWindows()
        else:
            print("Sender: Failed to decode image.")
    except Exception as e:
        print("Sender: Error decoding image:", e)

    await webrtc_adapter.close()
    signaling.writer.close()
    await signaling.writer.wait_closed()
    signaling_server.close()
    await signaling_server.wait_closed()
    print("Sender: Finished.")

if __name__ == "__main__":
    asyncio.run(sender_main())
