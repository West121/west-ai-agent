from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError


POSTGRES_URL = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/platform"


def test_platform_api_boots_and_seeds_against_postgres(monkeypatch) -> None:
    monkeypatch.setenv("APP_DATABASE_URL", POSTGRES_URL)

    config_module = importlib.import_module("app.core.config")
    db_module = importlib.import_module("app.core.db")
    model_modules = [
        "app.modules.auth.models",
        "app.modules.channel.models",
        "app.modules.conversation.models",
        "app.modules.customer.models",
        "app.modules.knowledge.models",
        "app.modules.service.models",
    ]
    main_module = importlib.import_module("app.main")

    config_module.get_settings.cache_clear()
    importlib.reload(config_module)
    importlib.reload(db_module)
    for module_name in model_modules:
        module = importlib.import_module(module_name)
        importlib.reload(module)
    importlib.reload(main_module)

    try:
        with db_module.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError:
        pytest.skip("Postgres is not available on 127.0.0.1:5432 for integration wiring test")

    db_module.Base.metadata.drop_all(bind=db_module.engine)

    with TestClient(main_module.app) as client:
        response = client.get("/healthz")
        assert response.status_code == 200

    session = db_module.SessionLocal()
    try:
        from app.modules.auth.models import User
        from app.modules.channel.models import ChannelApp
        from app.modules.knowledge.models import KnowledgeDocument

        assert session.query(User).filter(User.username == "admin").one_or_none() is not None
        assert session.query(ChannelApp).count() >= 1
        assert session.query(KnowledgeDocument).count() >= 1
    finally:
        session.close()
        db_module.Base.metadata.drop_all(bind=db_module.engine)
