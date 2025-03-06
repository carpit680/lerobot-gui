#!/usr/bin/env python
import asyncio
import socket
from zeroconf import ServiceBrowser, Zeroconf, ServiceListener
from openbot.comm.webrtc_adapter import WebRTCAdapter

SERVICE_TYPE = "_webrtc._tcp.local."

class SignalingServiceListener(ServiceListener):
    def __init__(self):
        self.service_info = None
        self.event = asyncio.Event()

    def add_service(self, zeroconf, service_type, name):
        info = zeroconf.get_service_info(service_type, name)
        if info:
            self.service_info = info
            self.event.set()

    def update_service(self, zeroconf, service_type, name):
        pass

    def remove_service(self, zeroconf, service_type, name):
        pass

async def discover_signaling_service(service_type=SERVICE_TYPE):
    zeroconf = Zeroconf()
    listener = SignalingServiceListener()
    ServiceBrowser(zeroconf, service_type, listener)
    print("Receiver: Searching for signaling service on the network...")
    try:
        await asyncio.wait_for(listener.event.wait(), timeout=10)
    except asyncio.TimeoutError:
        print("Receiver: Signaling service not found on network.")
        zeroconf.close()
        return None
    info = listener.service_info
    zeroconf.close()
    address = socket.inet_ntoa(info.addresses[0])
    port = info.port
    print(f"Receiver: Discovered signaling service at {address}:{port}")
    return address, port

async def receiver_main():
    discovery = await discover_signaling_service()
    if not discovery:
        print("Receiver: Could not find a signaling server. Using pre-configured IP.")
        signaling_address = '192.168.1.20'
        signaling_port = 12345
    else:
        signaling_address, signaling_port = discovery
    adapter = WebRTCAdapter(role="answer", signaling=None,
                            signaling_host=signaling_address,
                            signaling_port=signaling_port,
                            server_mode=False)
    try:
        await adapter.setup_connection()
        print("Receiver: WebRTC connection established.")
    except Exception as e:
        print("Receiver: Error during setup_connection:", e)
        return

    def on_message(msg):
        print("Receiver: Received sensor data:", msg)
    adapter.set_on_message(on_message)
    print("Receiver: Listening for sensor data. Press Ctrl+C to stop.")
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
