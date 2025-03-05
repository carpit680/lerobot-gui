from openbot.devices.sensors.camera import Camera
import cv2

# Optional configuration: set frame rate to 20 FPS and resolution to 800x600
config = {'frame_rate': 20, 'width': 1920, 'height': 1080}
cam = Camera(camera_index=0, config=config)

# Start the camera capture process
cam.start()

# Retrieve and display the latest frame in a loop
try:
    while True:
        frame = cam.get_latest_frame()
        if frame is not None:
            cv2.imshow("Camera Frame", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
finally:
    cam.stop()
    cv2.destroyAllWindows()
