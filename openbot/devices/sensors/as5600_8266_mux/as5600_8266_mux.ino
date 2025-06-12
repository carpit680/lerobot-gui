#include <Wire.h>

#define SDA_PIN D3 // GPIO0
#define SCL_PIN D4 // GPIO2
#define TCA9548A_ADDRESS 0x70
#define AS5600_ADDRESS 0x36
#define SENSOR_COUNT 6
const uint8_t mux_channels[SENSOR_COUNT] = {2, 3, 4, 5, 6, 7};

void tca9548aSelectChannel(uint8_t channel)
{
    Wire.beginTransmission(TCA9548A_ADDRESS);
    Wire.write(1 << channel);
    Wire.endTransmission();
}

bool readAS5600(uint16_t &angle)
{
    Wire.beginTransmission(AS5600_ADDRESS);
    Wire.write(0x0C);
    if (Wire.endTransmission(false) != 0)
        return false; // Check for error

    if (Wire.requestFrom(AS5600_ADDRESS, (uint8_t)2) != 2)
        return false;

    uint8_t highByte = Wire.read();
    uint8_t lowByte = Wire.read();
    angle = ((uint16_t)highByte << 8) | lowByte;
    return true;
}

void setup()
{
    Serial.begin(115200);
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setClock(100000); // Prefer I2C speed to 100kHz or lower for stable software I2C
}

void loop()
{
    for (uint8_t i = 0; i < SENSOR_COUNT; i++)
    {
        tca9548aSelectChannel(mux_channels[i]);
        uint16_t rawValue;
        if (readAS5600(rawValue))
        {
            Serial.print(rawValue);
        }
        else
        {
            Serial.print("ERR");
        }

        if (i < SENSOR_COUNT - 1)
        {
            Serial.print(",");
        }
    }
    Serial.println();
    delay(30);
}
