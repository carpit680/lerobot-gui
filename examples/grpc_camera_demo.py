#!/usr/bin/env python
import asyncio
import base64
import cv2
import grpc
import numpy as np
import socket

from openbot.devices.sensors.camera import Camera
from openbot.comm.grpc_adapter import GRPCAdapter
from openbot.comm.proto import comm_pb2, comm_pb2_grpc

# --- Dummy gRPC Service Implementation --- #
class DummyCommService(comm_pb2_grpc.CommServiceServicer):
    """
    A dummy gRPC service that receives messages via SendMessage.
    It prints the length of the received message and records it.
    """
    def __init__(self):
        self.received_messages = []

    async def Connect(self, request, context):
        # For this demo, the Connect method is unused.
        while False:
            yield

    async def SendMessage(self, request, context):
        print("Server received a message of length:", len(request.message))
        self.received_messages.append(request.message)
        return comm_pb2.SendMessageResponse()

def find_free_port():
    """
    Helper function to find a free port.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 0))
    _, port = s.getsockname()
    s.close()
    return port

async def start_grpc_server():
    """
    Starts a gRPC server with DummyCommService on a free port.
    Returns a tuple: (server, dummy_service, server_address)
    """
    port = find_free_port()
    server_address = f"localhost:{port}"
    server = grpc.aio.server()
    service = DummyCommService()
    comm_pb2_grpc.add_CommServiceServicer_to_server(service, server)
    server.add_insecure_port(server_address)
    await server.start()
    print("gRPC server started on", server_address)
    return server, service, server_address

async def run_demo():
    # Start the gRPC server.
    server, service, server_address = await start_grpc_server()

    # Create a Camera instance (from openbot/devices/sensors/camera.py).
    camera = Camera(camera_index=1)
    try:
        camera.start()
        # Allow a short time for the camera to capture a frame.
        await asyncio.sleep(1)
        frame = camera.get_latest_frame()
        if frame is None:
            print("No frame captured from camera.")
            return

        # Encode the frame as JPEG.
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            print("Failed to encode frame.")
            return

        jpg_bytes = buffer.tobytes()
        # Encode the JPEG bytes as a Base64 string (since our proto uses string fields).
        encoded_image = base64.b64encode(jpg_bytes).decode('utf-8')
        print("Captured and encoded an image from the camera.")

        # Create a GRPCAdapter client using the server address.
        adapter = GRPCAdapter(server_address=server_address)
        # Optionally, set an on_message callback (not used in this demo).
        adapter.set_on_message(lambda msg: print("Client received:", msg))
        await adapter.setup_connection()

        # Send the encoded image over gRPC.
        print("Client sending encoded image...")
        await adapter.send(encoded_image)
        await asyncio.sleep(1)  # Wait for the server to process the message.
        await adapter.close()

        # Check if the server received the message and try decoding it.
        if service.received_messages:
            received = service.received_messages[0]
            print("Server recorded an image message of length:", len(received))
            # Decode from Base64 back to JPEG bytes.
            decoded_bytes = base64.b64decode(received)
            # Decode the JPEG to a frame.
            image = cv2.imdecode(np.frombuffer(decoded_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is not None:
                print("Server successfully decoded the image.")
                # Optionally display the received image.
                cv2.imshow("Received Image", image)
                cv2.waitKey(2000)
                cv2.destroyAllWindows()
            else:
                print("Server failed to decode the image.")
        else:
            print("Server did not receive any messages.")
    finally:
        camera.stop()
        print("Shutting down server...")
        await server.stop(0)
        print("Server shut down.")

if __name__ == "__main__":
    asyncio.run(run_demo())
