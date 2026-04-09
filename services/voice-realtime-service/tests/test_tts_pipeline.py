from app.tts.sherpa_tts import SherpaTtsProvider


def test_sherpa_tts_returns_audio_payload() -> None:
    provider = SherpaTtsProvider()
    audio = provider.speak("您好，请提供订单号。")
    assert audio.mime_type == "audio/wav"
    assert audio.duration_ms >= 400
    assert audio.content.startswith("您好".encode("utf-8"))
