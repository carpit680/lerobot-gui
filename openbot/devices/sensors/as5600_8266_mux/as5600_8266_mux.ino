#include <Wire.h>

#define AS5600_ADDR 0x36 // 7-bit I2C address for AS5600

void setup()
{
    Serial.begin(115200);
    // Initialize I2C: Wire.begin(SDA, SCL)
    Wire.begin(D2, D1);
    delay(100);
    Serial.println("AS5600 Encoder Test");
}

void loop()
{
    uint16_t raw = readRawAngle();
    // AS5600 outputs a 12-bit angle (0–4095)
    float degrees = (raw * 360.0) / 4096.0;

    Serial.print("Raw: ");
    Serial.print(raw);
    Serial.print("   Angle: ");
    Serial.print(degrees, 2);
    Serial.println("°");

    delay(500);
}

// Reads two bytes from registers 0x0C (high) and 0x0D (low)
uint16_t readRawAngle()
{
    Wire.beginTransmission(AS5600_ADDR);
    Wire.write(0x0C);            // register address
    Wire.endTransmission(false); // restart

    Wire.requestFrom(AS5600_ADDR, (uint8_t)2);
    if (Wire.available() < 2)
        return 0;

    uint8_t hi = Wire.read();
    uint8_t lo = Wire.read();
    // lower 12 bits are the angle
    return ((uint16_t)hi << 8 | lo) & 0x0FFF;
}
