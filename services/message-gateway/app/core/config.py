from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from os import getenv

DEFAULT_APP_NAME = "message-gateway"
DEFAULT_APP_ENV = "development"
DEFAULT_APP_GATEWAY_HOST = "0.0.0.0"
DEFAULT_APP_GATEWAY_PORT = 8010
DEFAULT_APP_CORS_ORIGINS = ("*",)


def _read_optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _read_list(value: str | None, fallback: tuple[str, ...]) -> tuple[str, ...]:
    normalized = _read_optional(value)
    if normalized is None:
        return fallback
    if normalized.startswith("[") and normalized.endswith("]"):
        items = [
            part.strip().strip('"').strip("'")
            for part in normalized[1:-1].split(",")
            if part.strip().strip('"').strip("'")
        ]
    else:
        items = [part.strip() for part in normalized.split(",") if part.strip()]
    return tuple(items) or fallback


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = DEFAULT_APP_NAME
    app_env: str = DEFAULT_APP_ENV
    app_gateway_host: str = DEFAULT_APP_GATEWAY_HOST
    app_gateway_port: int = DEFAULT_APP_GATEWAY_PORT
    app_cors_origins: tuple[str, ...] = DEFAULT_APP_CORS_ORIGINS

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_name=_read_optional(getenv("APP_NAME")) or DEFAULT_APP_NAME,
            app_env=_read_optional(getenv("APP_ENV")) or DEFAULT_APP_ENV,
            app_gateway_host=_read_optional(getenv("APP_GATEWAY_HOST")) or DEFAULT_APP_GATEWAY_HOST,
            app_gateway_port=int(_read_optional(getenv("APP_GATEWAY_PORT")) or str(DEFAULT_APP_GATEWAY_PORT)),
            app_cors_origins=_read_list(getenv("APP_CORS_ORIGINS"), DEFAULT_APP_CORS_ORIGINS),
        )

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
