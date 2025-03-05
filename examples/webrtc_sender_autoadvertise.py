#!/usr/bin/env python
import asyncio
import socket
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceInfo
from openbot.devices.sensors.as5600_encoder import AS5600Sensor
from openbot.comm.webrtc_adapter import WebRTCAdapter, wait_for_channel_open

SERVICE_TYPE = "_webrtc._tcp.local."
SERVICE_NAME = "OpenBotSignaling._webrtc._tcp.local."
SIGNALING_PORT = 12345

def get_local_ip():
    """
    Get the local LAN IP address by creating a dummy socket connection.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to a public DNS server (doesn't actually send data).
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

async def advertise_service(local_ip):
    azc = AsyncZeroconf()
    ip_bytes = socket.inet_aton(local_ip)
    info = AsyncServiceInfo(
        SERVICE_TYPE,
        SERVICE_NAME,
        addresses=[ip_bytes],
        port=SIGNALING_PORT,
        properties={"info": "OpenBot signaling server"},
        server="openbot.local."
    )
    print("Sender: Advertising service via Zeroconf...")
    await azc.async_register_service(info)
    return azc, info

async def sender_main():
    local_ip = get_local_ip()
    print("Sender: Local IP address determined as", local_ip)
    
    # Advertise the signaling service.
    azc, info = await advertise_service(local_ip)
    
    # Initialize and start the AS5600 sensor.
    sensor = AS5600Sensor(serial_port='/dev/tty.usbserial-0001', baud_rate=115200)
    sensor.start()
    print("Sender: Sensor started. Gathering data...")
    await asyncio.sleep(1)
    
    data = sensor.get_latest_frame()
    if data is None:
        print("Sender: No sensor data available.")
        sensor.stop()
        await azc.async_unregister_service(info)
        await azc.async_close()
        return
    sensor_str = ",".join(map(str, data))
    print("Sender: Sensor data:", sensor_str)
    
    # Create a WebRTCAdapter in server mode.
    adapter = WebRTCAdapter(role="offer", signaling=None,
                            signaling_host=local_ip,
                            signaling_port=SIGNALING_PORT,
                            server_mode=True)
    try:
        await adapter.setup_connection()
    except Exception as e:
        print("Sender: Error during setup_connection:", e)
        sensor.stop()
        await azc.async_unregister_service(info)
        await azc.async_close()
        return

    if not await wait_for_channel_open(adapter):
        print("Sender: Data channel did not open in time.")
        await adapter.close()
        sensor.stop()
        await azc.async_unregister_service(info)
        await azc.async_close()
        return

    print("Sender: Data channel is open. Starting continuous sending...")
    try:
        while True:
            data = sensor.get_latest_frame()
            if data is not None:
                sensor_str = ",".join(map(str, data))
                print("Sender: Sending sensor data:", sensor_str)
                await adapter.send(sensor_str)
            else:
                print("Sender: No sensor data available.")
            await asyncio.sleep(0.1)
    except KeyboardInterrupt:
        print("Sender: Interrupted by user.")
    finally:
        await adapter.close()
        sensor.stop()
        await azc.async_unregister_service(info)
        await azc.async_close()
        print("Sender: Finished.")

if __name__ == "__main__":
    asyncio.run(sender_main())
