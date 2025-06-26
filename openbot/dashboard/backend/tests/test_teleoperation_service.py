import pytest
from backend.teleoperation_service import TeleoperationService

@pytest.fixture
def teleop_service():
    return TeleoperationService()

@pytest.mark.asyncio
async def test_start_teleoperation(monkeypatch, teleop_service):
    async def fake_start_teleoperation(*a, **kw):
        return "session789"
    monkeypatch.setattr(teleop_service, "start_teleoperation", fake_start_teleoperation)
    session_id = await teleop_service.start_teleoperation("giraffe", "/dev/ttyACM0", "leader", "giraffe", "/dev/ttyACM1", "follower", [])
    assert session_id == "session789"

@pytest.mark.asyncio
async def test_is_running(monkeypatch, teleop_service):
    async def fake_is_running(session_id):
        return True
    monkeypatch.setattr(teleop_service, "is_running", fake_is_running)
    assert await teleop_service.is_running("session789") is True

@pytest.mark.asyncio
async def test_stop_teleoperation(monkeypatch, teleop_service):
    async def fake_stop_teleoperation(session_id):
        return True
    monkeypatch.setattr(teleop_service, "stop_teleoperation", fake_stop_teleoperation)
    assert await teleop_service.stop_teleoperation("session789") is True
