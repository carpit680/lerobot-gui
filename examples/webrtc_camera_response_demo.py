#!/usr/bin/env python
import asyncio
import base64
import json
import socket
import cv2
import numpy as np
from aiortc import RTCSessionDescription

from openbot.devices.sensors.camera import Camera
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

async def connect_to_signaling(host='localhost', port=12345):
    """
    Continuously attempt to connect to the signaling server until successful.
    """
    while True:
        try:
            reader, writer = await asyncio.open_connection(host, port)
            print("Responder: Connected to signaling server.")
            return TcpSignaling(reader, writer)
        except ConnectionRefusedError:
            print("Responder: Signaling server not available, retrying in 1 second...")
            await asyncio.sleep(1)

async def responder_main():
    # Connect to the sender's signaling server.
    signaling = await connect_to_signaling()

    # Create a WebRTC adapter with role "answer" using the TCP signaling.
    webrtc_adapter = WebRTCAdapter(role="answer", signaling=signaling)
    try:
        await webrtc_adapter.setup_connection()
        print("Responder: WebRTC connection established.")
    except Exception as e:
        print("Responder: Error during setup_connection:", e)
        return

    # Set up a future to wait for sensor data from the sender.
    sensor_future = asyncio.Future()
    def on_sensor_message(msg):
        if not sensor_future.done():
            sensor_future.set_result(msg)
    webrtc_adapter.set_on_message(on_sensor_message)
    print("Responder: Waiting for sensor data...")
    sensor_data = await sensor_future
    print("Responder: Received sensor data:", sensor_data)

    # Capture an image using the camera.
    camera = Camera(camera_index=0)
    camera.start()
    print("Responder: Camera started, capturing frame...")
    await asyncio.sleep(1)  # Wait for the camera to capture a frame.
    frame = camera.get_latest_frame()
    camera.stop()

    if frame is None:
        print("Responder: No frame captured from camera.")
        response = ""
    else:
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            print("Responder: Failed to encode frame.")
            response = ""
        else:
            jpg_bytes = buffer.tobytes()
            response = base64.b64encode(jpg_bytes).decode('utf-8')
            print("Responder: Image encoded, length:", len(response))

    if response == "":
        print("Responder: Response is empty, not sending any data.")
    else:
        print("Responder: Sending image response...")
        await webrtc_adapter.send(response)
        # Wait extra time to allow the message to be delivered.
        await asyncio.sleep(1)

    await webrtc_adapter.close()
    signaling.writer.close()
    await signaling.writer.wait_closed()
    print("Responder: Finished.")

if __name__ == "__main__":
    asyncio.run(responder_main())
