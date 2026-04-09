from app.stt.final_funasr import FunAsrFinalizer
from app.stt.realtime_sherpa import SherpaRealtimeTranscriber


def test_sherpa_partial_transcript_streaming() -> None:
    provider = SherpaRealtimeTranscriber()
    partial = provider.stream_partial("我想咨询退款".encode("utf-8"))
    assert partial.text == "我想咨询退款"
    assert partial.is_final is False
    assert partial.confidence > 0


def test_funasr_finalizer_adds_sentence_final_punctuation() -> None:
    provider = FunAsrFinalizer()
    final = provider.finalize_segment("我想咨询退款")
    assert final.text == "我想咨询退款"
    assert final.normalized_text == "我想咨询退款。"
    assert final.confidence >= 0.9
