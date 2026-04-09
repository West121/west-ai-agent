from fastapi.testclient import TestClient

from app.main import app


def test_healthz() -> None:
    client = TestClient(app)
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_providers() -> None:
    client = TestClient(app)
    response = client.get("/providers")
    assert response.status_code == 200
    body = response.json()
    assert body["realtime_stt"] == "sherpa-onnx"
    assert body["finalizer"] == "funasr"
    assert body["tts"] == "sherpa-onnx"
