import numpy as np
import cv2
import time
import pytest

# Import the Camera class from the sensors package
from openbot.devices.sensors.camera import Camera
# Import the Sensor interface to verify interface compliance
from openbot.interfaces.sensor_interface import Sensor

# Dummy VideoCapture class to simulate a camera
class DummyVideoCapture:
    def __init__(self, index):
        self.index = index
        self.opened = True
        self.frame_count = 0
        # Default resolution for testing
        self.width = 640
        self.height = 480

    def isOpened(self):
        return self.opened

    def read(self):
        # Create a dummy frame with incremental pixel values
        self.frame_count += 1
        dummy_frame = np.full((self.height, self.width, 3), self.frame_count % 256, dtype=np.uint8)
        return True, dummy_frame

    def release(self):
        self.opened = False

    def set(self, propId, value):
        # Simulate setting camera properties
        if propId == cv2.CAP_PROP_FRAME_WIDTH:
            self.width = int(value)
        elif propId == cv2.CAP_PROP_FRAME_HEIGHT:
            self.height = int(value)
        # Other properties are ignored for simplicity

# Fixture to monkeypatch cv2.VideoCapture with DummyVideoCapture
@pytest.fixture(autouse=True)
def patch_video_capture(monkeypatch):
    monkeypatch.setattr(cv2, "VideoCapture", DummyVideoCapture)

def test_find_available_cameras(monkeypatch):
    """
    Test the find_available_cameras method.
    Simulate that only indexes 0 and 1 are available.
    """
    def fake_video_capture(index):
        dummy = DummyVideoCapture(index)
        # Simulate that only indexes 0 and 1 are open
        dummy.opened = (index in [0, 1])
        return dummy

    monkeypatch.setattr(cv2, "VideoCapture", fake_video_capture)
    available = Camera.find_available_cameras(max_index=5)
    assert available == [0, 1]

def test_camera_start_get_stop():
    """
    Test that the Camera can start, capture a frame,
    and stop without errors.
    """
    config = {'frame_rate': 10, 'width': 320, 'height': 240}
    cam = Camera(camera_index=0, config=config)
    cam.start()
    time.sleep(0.5)  # Allow time for frames to be captured
    frame = cam.get_latest_frame()
    assert frame is not None, "No frame was captured."
    assert frame.shape == (config['height'], config['width'], 3), "Frame dimensions do not match config."
    cam.stop()

def test_camera_multiple_frames():
    """
    Test that multiple frames are captured and updated over time.
    """
    cam = Camera(camera_index=0)
    cam.start()
    time.sleep(0.2)
    frame1 = cam.get_latest_frame()
    time.sleep(0.2)
    frame2 = cam.get_latest_frame()
    assert frame1 is not None and frame2 is not None, "One of the frames is None."
    # Ensure that the dummy frame values change over time
    assert not np.array_equal(frame1, frame2), "The frames are identical; expected different frames."
    cam.stop()

def test_camera_fail_to_open(monkeypatch):
    """
    Test that Camera.start() raises a RuntimeError when the camera fails to open.
    """
    # Create a subclass that simulates a failure to open the camera
    class FailVideoCapture(DummyVideoCapture):
        def isOpened(self):
            return False

    monkeypatch.setattr(cv2, "VideoCapture", lambda index: FailVideoCapture(index))
    cam = Camera(camera_index=999, config={'frame_rate': 10, 'width': 320, 'height': 240})
    with pytest.raises(RuntimeError):
        cam.start()

def test_camera_extreme_configuration():
    """
    Test the Camera with extreme configuration values.
    """
    config = {'frame_rate': 1, 'width': 1920, 'height': 1080}
    cam = Camera(camera_index=0, config=config)
    cam.start()
    time.sleep(1.5)  # Allow several frames at low frame rate
    frame = cam.get_latest_frame()
    assert frame is not None, "No frame captured with extreme configuration."
    assert frame.shape == (config['height'], config['width'], 3), "Frame dimensions do not match extreme configuration."
    cam.stop()

def test_camera_interface_compliance():
    """
    Test that the Camera class implements the Sensor interface.
    """
    config = {'frame_rate': 10, 'width': 320, 'height': 240}
    cam = Camera(camera_index=0, config=config)
    # Check that cam is an instance of Sensor
    assert isinstance(cam, Sensor), "Camera does not implement the Sensor interface."
