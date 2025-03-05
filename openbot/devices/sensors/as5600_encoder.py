import serial
import threading
import time
from openbot.interfaces.sensor_interface import Sensor

class AS5600Sensor(Sensor):
    # TODO@carpit680: make this configurable for any DoF arm
    def __init__(self, serial_port='/dev/ttyUSB0', baud_rate=115200, custom_zero=[2330, 845, 3450, 590, 3030, 1330], inversion=[False, False, True, True, True, False], deg=False):
        """
        Initialize the AS5600 sensor class.

        Args:
            serial_port (str): Serial port for communication (default: '/dev/ttyUSB0').
            baud_rate (int): Baud rate for serial communication (default: 115200).
        """
        self.serial_port = serial_port
        self.baud_rate = baud_rate
        self.custom_zero = custom_zero
        self.inversion = inversion
        self.deg = deg
        try:
            self.esp32 = serial.Serial(serial_port, baud_rate, timeout=0.01)
        except serial.SerialException as e:
            print(f"Error initializing serial port: {e}")
            self.esp32 = None
        self._latest_data = None
        self._running = False
        self._thread = None
        print("AS5600 Sensor class has been Initialized")

    def convert_raw_to_radians(self, raw_value, reference):
        """
        Convert raw AS5600 value (0-4095) to radians with custom zero.

        Args:
            raw_value (int): Raw value from the AS5600 sensor.
            reference (int): Custom zero reference value.

        Returns:
            float: Angle in radians, normalized to -pi to pi.
        """
        adjusted_value = (raw_value - reference + 4096) % 4096
        radians = (adjusted_value / 4096.0) * 2 * 3.14159
        radians = (radians + 3.14159) % (2 * 3.14159) - 3.14159
        # return only 5 digits after decimal
        return round(radians, 5)

    def convert_raw_to_degrees(self, raw_value, reference):
        """
        Convert raw AS5600 value (0-4095) to degrees with custom zero.

        Args:
            raw_value (int): Raw value from the AS5600 sensor.
            reference (int): Custom zero reference value.

        Returns:
            float: Angle in degrees, normalized to -180° to 180°.
        """
        adjusted_value = (raw_value - reference + 4096) % 4096
        degrees = (adjusted_value / 4096.0) * 360.0
        degrees = (degrees + 180) % 360 - 180
        return round(degrees, 5)

    def map_value(self, x, in_min, in_max, out_min, out_max):
        """
        Linearly map a value from one range to another.

        Args:
            x (float): Input value.
            in_min (float): Minimum value of input range.
            in_max (float): Maximum value of input range.
            out_min (float): Minimum value of output range.
            out_max (float): Maximum value of output range.

        Returns:
            float: Mapped value.
        """
        return round(max(out_min, min(out_max, (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min)), 5)

    def read_sensor_data(self):
        """
        Read raw sensor data from the ESP32 and return the angles in degrees.
        """
        try:
            new_data = self.esp32.readline().decode('utf-8').strip() if self.esp32 else ""
            if new_data:
                raw_values = list(map(int, new_data.split(",")))
                if self.deg:
                    angles = [self.convert_raw_to_degrees(raw_values[i], self.custom_zero[i]) for i in range(len(raw_values))]
                else:
                    angles = [self.convert_raw_to_radians(raw_values[i], self.custom_zero[i]) for i in range(len(raw_values))]
                gripper_value = self.map_value(raw_values[5], 1325, 2808, 0, 25)
                # Negate some angles as required.
                sensor_values = [angles[i] if not self.inversion[i] else -angles[i] for i in range(len(angles)) ]
                sensor_values[5] = gripper_value
                
                return sensor_values
        except serial.SerialException as e:
            print(f"Warning from AS5600: {e}")
        except ValueError:
            return None
        except IndexError:
            print("Warning from AS5600: Index out of range.")
        except Exception as e:
            print(f"Warning from AS5600: {e}")
        return None

    def _update(self):
        """
        Internal method that continuously reads sensor data and stores the latest reading.
        """
        while self._running:
            reading = self.read_sensor_data()
            if reading is not None:
                self._latest_data = reading

    # --- Methods required by the Sensor interface ---
    def start(self):
        """
        Start the sensor device by beginning the background thread for polling sensor data.
        """
        if self.esp32 is None:
            print("Cannot start sensor: serial port not initialized.")
            return
        self._running = True
        self._thread = threading.Thread(target=self._update, daemon=True)
        self._thread.start()
        print("AS5600 Sensor started.")

    def stop(self):
        """
        Stop the sensor device and close the serial port.
        """
        self._running = False
        if self._thread is not None:
            self._thread.join()
        if self.esp32 is not None:
            self.esp32.close()
        print("AS5600 Sensor stopped.")

    def get_latest_frame(self):
        """
        Retrieve the most recent sensor reading (i.e., the list of angles).

        Returns:
            list: Latest sensor data or None if no data is available.
        """
        return self._latest_data

# Example usage when run as a script.
if __name__ == "__main__":
    sensor = AS5600Sensor(serial_port='/dev/tty.usbserial-0001', baud_rate=115200)
    sensor.start()
    try:
        while True:
            data = sensor.get_latest_frame()
            if data is not None:
                print("Sensor Data:", data)
            time.sleep(0.01)
    except KeyboardInterrupt:
        print("\nExiting gracefully...")
    finally:
        sensor.stop()
