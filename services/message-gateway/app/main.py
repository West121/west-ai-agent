from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes.messages import router as messages_router
from app.routes.health import router as health_router
from app.routes.presence import router as presence_router
from app.ws.router import router as websocket_router

settings = get_settings()

if settings.is_production and settings.app_cors_origins == ["*"]:
    raise RuntimeError("APP_CORS_ORIGINS must be restricted in production for message-gateway.")

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(presence_router)
app.include_router(messages_router)
app.include_router(websocket_router)


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_gateway_host,
        port=settings.app_gateway_port,
        reload=False,
    )
