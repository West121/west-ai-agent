from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.conversation.crud import create_conversation, get_conversation_summary, upsert_satisfaction
from app.modules.conversation.schemas import (
    ConversationCreate,
    ConversationRead,
    ConversationSummaryRead,
    SatisfactionCreate,
    SatisfactionRead,
)
from app.modules.customer.crud import create_customer_profile
from app.modules.customer.schemas import CustomerProfileCreate, CustomerProfileRead
from app.modules.service.crud import create_leave_message
from app.modules.service.schemas import LeaveMessageCreate, LeaveMessageRead

router = APIRouter(prefix="/public", tags=["public"])


@router.post("/customer/profiles", response_model=CustomerProfileRead, status_code=status.HTTP_201_CREATED)
def post_public_profile(payload: CustomerProfileCreate, db: Session = Depends(get_db)) -> CustomerProfileRead:
    return create_customer_profile(db, payload)


@router.post(
    "/conversation/conversations",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
)
def post_public_conversation(payload: ConversationCreate, db: Session = Depends(get_db)) -> ConversationRead:
    return create_conversation(db, payload)


@router.get(
    "/conversation/conversations/{conversation_id}/summary",
    response_model=ConversationSummaryRead,
)
def get_public_conversation_summary(
    conversation_id: int,
    db: Session = Depends(get_db),
) -> ConversationSummaryRead:
    summary = get_conversation_summary(db, conversation_id)
    return ConversationSummaryRead(
        conversation_id=summary.conversation_id,
        ai_summary=summary.ai_summary,
        message_count=summary.message_count,
        last_message_at=summary.last_message_at,
        satisfaction_score=None,
    )


@router.post(
    "/conversation/conversations/{conversation_id}/satisfaction",
    response_model=SatisfactionRead,
    status_code=status.HTTP_201_CREATED,
)
def post_public_satisfaction(
    conversation_id: int,
    payload: SatisfactionCreate,
    db: Session = Depends(get_db),
) -> SatisfactionRead:
    satisfaction = upsert_satisfaction(db, conversation_id, payload)
    return SatisfactionRead(
        conversation_id=satisfaction.conversation_id,
        score=satisfaction.score,
        comment=satisfaction.comment,
        created_at=satisfaction.created_at,
        updated_at=satisfaction.updated_at,
    )


@router.post(
    "/service/leave-messages",
    response_model=LeaveMessageRead,
    status_code=status.HTTP_201_CREATED,
)
def post_public_leave_message(
    payload: LeaveMessageCreate,
    db: Session = Depends(get_db),
) -> LeaveMessageRead:
    return create_leave_message(db, payload)
