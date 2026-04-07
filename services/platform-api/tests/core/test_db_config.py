from __future__ import annotations

from app.core.config import Settings
from app.core.db import build_engine


def test_build_engine_uses_sqlite_connect_args_for_sqlite() -> None:
    engine = build_engine("sqlite:///./platform_api.db")

    assert engine.url.render_as_string(hide_password=False) == "sqlite:///./platform_api.db"
    assert engine.url.drivername == "sqlite"
    assert engine.pool._pre_ping is False


def test_build_engine_uses_postgres_driver_without_sqlite_connect_args() -> None:
    engine = build_engine("postgresql+psycopg://postgres:postgres@127.0.0.1:5432/platform")

    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.pool._pre_ping is True


def test_settings_disable_bootstrap_defaults_in_production() -> None:
    settings = Settings(app_env="production")

    assert settings.is_production is True
    assert settings.bootstrap_default_admin is False
    assert settings.bootstrap_sample_data is False


def test_settings_allow_explicit_bootstrap_override_in_production() -> None:
    settings = Settings(
        app_env="production",
        app_bootstrap_default_admin=True,
        app_bootstrap_sample_data=True,
    )

    assert settings.bootstrap_default_admin is True
    assert settings.bootstrap_sample_data is True
