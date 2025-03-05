#!/usr/bin/env python
import asyncio
from openbot.comm.webrtc_adapter import WebRTCAdapter

async def receiver_main():
    # Create a WebRTC adapter with role "answer" in client mode.
    # This adapter will connect to the sender's signaling server at localhost:12345.
    adapter = WebRTCAdapter(role="answer", signaling=None,
                            signaling_host="localhost", signaling_port=12345,
                            server_mode=False)
    try:
        await adapter.setup_connection()
        print("Receiver: WebRTC connection established.")
    except Exception as e:
        print("Receiver: Error during setup_connection:", e)
        return

    # Register a callback to continuously print received sensor data.
    def on_message(msg):
        print("Receiver: Received sensor data:", msg)
    adapter.set_on_message(on_message)
    
    print("Receiver: Now listening for sensor data. Press Ctrl+C to stop.")
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        print("Receiver: Interrupted by user.")
    finally:
        await adapter.close()
        print("Receiver: Finished.")

if __name__ == "__main__":
    asyncio.run(receiver_main())
