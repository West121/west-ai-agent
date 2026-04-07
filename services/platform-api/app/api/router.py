from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.channel.router import router as channel_router
from app.modules.conversation.router import router as conversation_router
from app.modules.customer.router import router as customer_router
from app.modules.exporting.router import router as exporting_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.public.router import router as public_router
from app.modules.service.router import router as service_router
from app.modules.video.router import router as video_router
from app.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(public_router)
api_router.include_router(channel_router)
api_router.include_router(customer_router)
api_router.include_router(conversation_router)
api_router.include_router(exporting_router)
api_router.include_router(knowledge_router)
api_router.include_router(service_router)
api_router.include_router(video_router)
