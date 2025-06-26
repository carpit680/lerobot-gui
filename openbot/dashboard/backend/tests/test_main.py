import warnings
warnings.filterwarnings("ignore", message="The 'app' shortcut is now deprecated")

import pytest
from fastapi.testclient import TestClient
from backend import main

client = TestClient(main.app)

@pytest.fixture(autouse=True)
def patch_services(monkeypatch):
    async def fake_start_calibration(*a, **kw):
        return "session123"
    async def fake_start_motor_setup(*a, **kw):
        return "session456"
    monkeypatch.setattr(main.calibration_service_instance, "start_calibration", fake_start_calibration)
    monkeypatch.setattr(main.motor_setup_service, "start_motor_setup", fake_start_motor_setup)

def test_health_check():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'healthy'}

def test_calibrate_start():
    response = client.post('/calibrate/start', json={
        'arm_type': 'leader',
        'robot_type': 'so100_leader',
        'port': '/dev/ttyUSB0',
        'robot_id': 'test'
    })
    if response.status_code != 200:
        print('Response status:', response.status_code)
        print('Response body:', response.text)
    assert response.status_code == 200
    assert response.json()['session_id'] == 'session123'

# Add more endpoint and error tests as needed 