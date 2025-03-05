import cv2
import threading
import time
from openbot.interfaces.sensor_interface import Sensor

class Camera(Sensor):
    """
    Camera class to manage a single camera device.

    This class opens a camera device using OpenCV, applies an optional configuration,
    and continuously grabs frames in a background thread. The latest frame can be retrieved
    via the get_latest_frame method.
    """
    
    def __init__(self, camera_index=0, config=None):
        self.camera_index = camera_index
        default_config = {
            'frame_rate': 30,
            'width': 640,
            'height': 480
        }
        if config is not None:
            default_config.update(config)
        self.config = default_config

        self.frame_rate = self.config.get('frame_rate', 30)
        self.width = self.config.get('width', 640)
        self.height = self.config.get('height', 480)

        self._capture = None  # OpenCV VideoCapture object
        self._running = False  # Control flag for the capture thread
        self._latest_frame = None  # Store the most recent frame
        self._lock = threading.Lock()  # Lock for thread-safe access to the frame
        self._thread = None  # Thread that continuously grabs frames

    def start(self):
        """
        Start the camera capture process.
        """
        self._capture = cv2.VideoCapture(self.camera_index)
        if not self._capture.isOpened():
            raise RuntimeError(f"Failed to open camera with index {self.camera_index}")

        self._capture.set(cv2.CAP_PROP_FPS, self.frame_rate)
        self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

        self._running = True
        self._thread = threading.Thread(target=self._update, daemon=True)
        self._thread.start()

    def _update(self):
        """
        Continuously capture frames in a background thread.
        """
        interval = 1.0 / self.frame_rate
        while self._running:
            ret, frame = self._capture.read()
            if ret:
                with self._lock:
                    self._latest_frame = frame
            else:
                time.sleep(0.01)
            time.sleep(interval)

    def get_latest_frame(self):
        """
        Retrieve the most recent frame captured by the camera.

        Returns:
            The latest frame as a NumPy array, or None if no frame has been captured.
        """
        with self._lock:
            return self._latest_frame.copy() if self._latest_frame is not None else None

    def stop(self):
        """
        Stop the camera capture process and release the device.
        """
        self._running = False
        if self._thread is not None:
            self._thread.join()
        if self._capture is not None:
            self._capture.release()

    @staticmethod
    def find_available_cameras(max_index=10):
        """
        Scan and return a list of available camera indexes.

        Args:
            max_index (int): Maximum camera index to check.

        Returns:
            List[int]: A list of camera indexes that are available.
        """
        available = []
        for index in range(max_index):
            cap = cv2.VideoCapture(index)
            if cap is not None and cap.isOpened():
                available.append(index)
                cap.release()
        return available
