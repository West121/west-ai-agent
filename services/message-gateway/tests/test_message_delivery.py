from fastapi.testclient import TestClient

from app.main import app
import pytest


def test_websocket_connection_updates_presence() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/support-room?client_id=agent-1&role=agent") as websocket:
        payload = websocket.receive_json()
        assert payload["type"] == "connection.ack"
        assert payload["conversation_id"] == "support-room"
        assert payload["client_id"] == "agent-1"

        presence = client.get("/presence/support-room")
        assert presence.status_code == 200
        assert presence.json()["online_count"] == 1
        assert presence.json()["clients"][0]["client_id"] == "agent-1"


def test_message_broadcast_and_unread_counter() -> None:
    client = TestClient(app)
    observer = TestClient(app)

    with client.websocket_connect("/ws/chat-1?client_id=agent-1&role=agent") as agent_ws:
        agent_ws.receive_json()
        with client.websocket_connect("/ws/chat-1?client_id=customer-1&role=customer") as customer_ws:
            customer_ws.receive_json()

            agent_ws.send_json({"type": "message.send", "text": "退款多久到账？"})
            agent_message = agent_ws.receive_json()
            customer_message = customer_ws.receive_json()

            assert agent_message["type"] == "message.new"
            assert customer_message["type"] == "message.new"
            assert customer_message["conversation_id"] == "chat-1"
            assert customer_message["sender_id"] == "agent-1"
            assert customer_message["text"] == "退款多久到账？"

            unread = observer.get("/unread/chat-1/customer-1")
            assert unread.status_code == 200
            assert unread.json()["count"] == 1

            reset = observer.post("/unread/chat-1/customer-1/reset")
            assert reset.status_code == 200
            assert reset.json()["count"] == 0


def test_message_ack_updates_store_and_read_state() -> None:
    client = TestClient(app)
    observer = TestClient(app)

    with client.websocket_connect("/ws/chat-ack?client_id=agent-1&role=agent") as agent_ws:
        agent_ws.receive_json()
        with client.websocket_connect("/ws/chat-ack?client_id=customer-1&role=customer") as customer_ws:
            customer_ws.receive_json()

            agent_ws.send_json({"type": "message.send", "text": "你已进入回执测试"})
            agent_message = agent_ws.receive_json()
            customer_message = customer_ws.receive_json()

            assert agent_message["type"] == "message.new"
            assert customer_message["type"] == "message.new"
            assert customer_message["status"] == "sent"

            customer_ws.send_json({"type": "message.ack", "message_id": customer_message["id"]})
            ack_payload = agent_ws.receive_json()
            assert ack_payload["type"] == "message.ack"
            assert ack_payload["message_id"] == customer_message["id"]
            assert ack_payload["status"] == "read"
            assert ack_payload["acked_by"] == "customer-1"

            unread = observer.get("/unread/chat-ack/customer-1")
            assert unread.status_code == 200
            assert unread.json()["count"] == 0

            messages = observer.get("/messages/chat-ack")
            assert messages.status_code == 200
            items = messages.json()["items"]
            assert len(items) == 1
            assert items[0]["status"] == "read"
            assert items[0]["acked_by"] == "customer-1"


def test_http_append_message_broadcasts_and_persists() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/chat-http?client_id=customer-2&role=customer") as customer_ws:
        customer_ws.receive_json()

        response = client.post(
            "/messages/chat-http",
            json={
                "sender_id": "ai-bot",
                "sender_role": "assistant",
                "text": "这是机器人回复",
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["sender_id"] == "ai-bot"
        assert payload["sender_role"] == "assistant"

        broadcast = customer_ws.receive_json()
        assert broadcast["type"] == "message.new"
        assert broadcast["text"] == "这是机器人回复"

        messages = client.get("/messages/chat-http")
        assert messages.status_code == 200
        items = messages.json()["items"]
        assert len(items) == 1
        assert items[0]["sender_role"] == "assistant"


@pytest.mark.parametrize(
    ("event_type", "payload", "expected_keys"),
    [
        (
            "video.offer",
            {"type": "video.offer", "sdp": "offer-sdp", "session_id": "video-room-1"},
            {"sdp": "offer-sdp"},
        ),
        (
            "video.answer",
            {"type": "video.answer", "sdp": "answer-sdp", "session_id": "video-room-1"},
            {"sdp": "answer-sdp"},
        ),
        (
            "video.ice-candidate",
            {
                "type": "video.ice-candidate",
                "candidate": {"candidate": "candidate-a", "sdpMLineIndex": 0},
                "session_id": "video-room-1",
            },
            {"candidate": {"candidate": "candidate-a", "sdpMLineIndex": 0}},
        ),
        (
            "video.recording.started",
            {
                "type": "video.recording.started",
                "recording_id": "rec-1",
                "file_key": "video/rec-1.webm",
                "playback_url": "/video/recordings/rec-1/playback",
            },
            {"recording_id": "rec-1", "file_key": "video/rec-1.webm"},
        ),
        (
            "video.recording.stopped",
            {
                "type": "video.recording.stopped",
                "recording_id": "rec-1",
                "file_key": "video/rec-1.webm",
                "duration_seconds": 132,
                "playback_url": "/video/recordings/rec-1/playback",
            },
            {"recording_id": "rec-1", "duration_seconds": 132},
        ),
    ],
)
def test_video_signaling_events_relay_to_peer(
    event_type: str,
    payload: dict[str, object],
    expected_keys: dict[str, object],
) -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/video-room-1?client_id=agent-1&role=agent") as agent_ws:
        agent_ws.receive_json()
        with client.websocket_connect("/ws/video-room-1?client_id=customer-1&role=customer") as customer_ws:
            customer_ws.receive_json()

            agent_ws.send_json(payload)
            relay = customer_ws.receive_json()

            assert relay["type"] == event_type
            assert relay["conversation_id"] == "video-room-1"
            assert relay["sender_id"] == "agent-1"
            assert relay["sender_role"] == "agent"
            for key, value in expected_keys.items():
                assert relay[key] == value
