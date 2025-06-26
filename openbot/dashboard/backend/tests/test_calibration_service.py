import pytest
from backend.calibration_service import CalibrationService

@pytest.fixture
def calibration_service():
    return CalibrationService()

@pytest.mark.asyncio
async def test_start_calibration(monkeypatch, calibration_service):
    async def fake_start_calibration(*a, **kw):
        return "session123"
    monkeypatch.setattr(calibration_service, "start_calibration", fake_start_calibration)
    session_id = await calibration_service.start_calibration("follower", "so100_follower", "/dev/ttyACM0", "test")
    assert session_id == "session123"

@pytest.mark.asyncio
async def test_is_running(monkeypatch, calibration_service):
    async def fake_is_running(session_id):
        return True
    monkeypatch.setattr(calibration_service, "is_running", fake_is_running)
    assert await calibration_service.is_running("session123") is True

@pytest.mark.asyncio
async def test_stop_calibration(monkeypatch, calibration_service):
    async def fake_stop_calibration(session_id):
        return True
    monkeypatch.setattr(calibration_service, "stop_calibration", fake_stop_calibration)
    assert await calibration_service.stop_calibration("session123") is True 