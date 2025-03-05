#!/usr/bin/env python
import asyncio
import time
from openbot.devices.sensors.as5600_encoder import AS5600Sensor
from openbot.comm.webrtc_adapter import WebRTCAdapter

async def sender_main():
    # Initialize and start the AS5600 sensor.
    sensor = AS5600Sensor(serial_port='/dev/tty.usbserial-0001', baud_rate=115200)
    sensor.start()
    print("Sender: Sensor started. Gathering data...")

    # Wait a moment for sensor data to start updating.
    await asyncio.sleep(1)

    # Create a WebRTCAdapter with role "offer" in server mode.
    # This adapter will start its own TCP signaling server on localhost:12345.
    adapter = WebRTCAdapter(role="offer", signaling=None,
                            signaling_host="localhost", signaling_port=12345,
                            server_mode=True)
    try:
        await adapter.setup_connection()
    except Exception as e:
        print("Sender: Error during setup_connection:", e)
        sensor.stop()
        return

    # Wait until the data channel is open.
    if not await adapter.wait_for_channel_open():
        print("Sender: Data channel did not open in time.")
        await adapter.close()
        sensor.stop()
        return

    print("Sender: Data channel is open. Starting continuous sending...")
    try:
        while True:
            data = sensor.get_latest_frame()
            if data is not None:
                # Convert sensor data (list of angles) to a comma-separated string.
                sensor_str = ",".join(map(str, data))
                print("Sender: Sending sensor data:", sensor_str)
                await adapter.send(sensor_str)
            else:
                print("Sender: No sensor data available.")
            await asyncio.sleep(0.1)  # Send data every 0.5 seconds
    except KeyboardInterrupt:
        print("Sender: Interrupted by user.")
    finally:
        await adapter.close()
        sensor.stop()
        print("Sender: Finished.")

if __name__ == "__main__":
    asyncio.run(sender_main())
