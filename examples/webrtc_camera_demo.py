#!/usr/bin/env python
import asyncio
import base64
import cv2
import numpy as np

from openbot.devices.sensors.camera import Camera
from openbot.comm.webrtc_adapter import WebRTCAdapter

# --- Dummy Signaling Implementation ---
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

# --- Offer Side: Capture and Send Image ---
async def offer_side(adapter: WebRTCAdapter, camera: Camera):
    # Wait briefly for the connection to be established.
    await asyncio.sleep(1)
    frame = camera.get_latest_frame()
    if frame is None:
        print("Offer: No frame captured.")
        return
    # Encode the frame as JPEG.
    ret, buffer = cv2.imencode('.jpg', frame)
    if not ret:
        print("Offer: Failed to encode frame.")
        return
    jpg_bytes = buffer.tobytes()
    # Encode JPEG bytes to a Base64 string.
    encoded_image = base64.b64encode(jpg_bytes).decode('utf-8')
    print("Offer: Sending encoded image...")
    await adapter.send(encoded_image)

# --- Answer Side: Receive and Display Image ---
async def answer_side(adapter: WebRTCAdapter):
    # Create a future to wait for the incoming message.
    future = asyncio.Future()

    def on_message(msg):
        if not future.done():
            future.set_result(msg)

    adapter.set_on_message(on_message)
    print("Answer: Waiting to receive image...")
    # Wait for the message.
    msg = await future
    # Decode the Base64 string back to JPEG bytes.
    jpg_bytes = base64.b64decode(msg)
    # Decode JPEG bytes into an image frame.
    image = cv2.imdecode(np.frombuffer(jpg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is not None:
        print("Answer: Displaying received image...")
        cv2.imshow("Received Image", image)
        cv2.waitKey(2000)
        cv2.destroyAllWindows()
    else:
        print("Answer: Failed to decode image.")

# --- Main Function ---
async def main():
    # Create dummy signaling pair.
    signaling_pair = DummySignalingPair()
    offer_signaling = signaling_pair.get_offer_signaling()
    answer_signaling = signaling_pair.get_answer_signaling()

    # Create WebRTCAdapter instances for offer and answer roles.
    offer_adapter = WebRTCAdapter(role="offer", signaling=offer_signaling)
    answer_adapter = WebRTCAdapter(role="answer", signaling=answer_signaling)

    # Establish the WebRTC connection concurrently.
    await asyncio.gather(
        offer_adapter.setup_connection(),
        answer_adapter.setup_connection()
    )

    # Initialize the camera.
    camera = Camera(camera_index=0)
    camera.start()
    # Allow some time for the camera to initialize and capture a frame.
    await asyncio.sleep(1)

    # Run offer and answer tasks concurrently.
    await asyncio.gather(
        offer_side(offer_adapter, camera),
        answer_side(answer_adapter)
    )

    # Clean up: stop camera and close connections.
    camera.stop()
    await asyncio.gather(
        offer_adapter.close(),
        answer_adapter.close()
    )

if __name__ == "__main__":
    asyncio.run(main())
