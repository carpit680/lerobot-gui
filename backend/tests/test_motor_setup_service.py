import pytest
from backend.motor_setup_service import MotorSetupService

@pytest.fixture
def motor_setup_service():
    return MotorSetupService()

@pytest.mark.asyncio
async def test_start_motor_setup(monkeypatch, motor_setup_service):
    async def fake_start_motor_setup(*a, **kw):
        return "session456"
    monkeypatch.setattr(motor_setup_service, "start_motor_setup", fake_start_motor_setup)
    session_id = await motor_setup_service.start_motor_setup("so100", "/dev/ttyACM0")
    assert session_id == "session456"

@pytest.mark.asyncio
async def test_is_running(monkeypatch, motor_setup_service):
    async def fake_is_running(session_id):
        return True
    monkeypatch.setattr(motor_setup_service, "is_running", fake_is_running)
    assert await motor_setup_service.is_running("session456") is True

@pytest.mark.asyncio
async def test_stop_motor_setup(monkeypatch, motor_setup_service):
    async def fake_stop_motor_setup(session_id):
        return True
    monkeypatch.setattr(motor_setup_service, "stop_motor_setup", fake_stop_motor_setup)
    assert await motor_setup_service.stop_motor_setup("session456") is True
