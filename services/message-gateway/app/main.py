from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.messages import router as messages_router
from app.routes.health import router as health_router
from app.routes.presence import router as presence_router
from app.ws.router import router as websocket_router

app = FastAPI(title="message-gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
