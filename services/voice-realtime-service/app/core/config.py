from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="VOICE_REALTIME_", extra="ignore")

    app_name: str = "voice-realtime-service"
    app_host: str = "127.0.0.1"
    app_port: int = 18030
    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:14173",
            "http://127.0.0.1:14174",
            "http://127.0.0.1:48173",
            "http://127.0.0.1:48174",
        ]
    )
    realtime_stt_provider: str = Field(default="sherpa-onnx")
    finalizer_provider: str = Field(default="funasr")
    tts_provider: str = Field(default="sherpa-onnx")
    livekit_ws_url: str = Field(default="ws://127.0.0.1:17880")
    ai_service_base_url: str = Field(default="http://127.0.0.1:18020")
    platform_api_base_url: str = Field(default="http://127.0.0.1:18000")
    message_gateway_base_url: str = Field(default="http://127.0.0.1:18010")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
