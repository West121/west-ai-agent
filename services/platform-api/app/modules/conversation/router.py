from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.conversation.crud import (
    create_conversation,
    end_conversation,
    get_conversation,
    get_conversation_summary,
    get_satisfaction,
    list_conversation_history,
    list_conversations,
    transfer_conversation,
    upsert_satisfaction,
)
from app.modules.conversation.schemas import (
    ConversationCreate,
    ConversationEnd,
    ConversationHistoryListResponse,
    ConversationRead,
    ConversationSummaryRead,
    ConversationTransfer,
    SatisfactionCreate,
    SatisfactionRead,
)

router = APIRouter(prefix="/conversation", tags=["conversation"])


@router.post("/conversations", response_model=ConversationRead, status_code=201)
def post_conversation(
    payload: ConversationCreate,
    _: object = Depends(require_permissions("conversation.write")),
    db: Session = Depends(get_db),
) -> ConversationRead:
    return create_conversation(db, payload)


@router.get("/conversations", response_model=list[ConversationRead])
def get_conversations(
    _: object = Depends(require_permissions("conversation.read")),
    db: Session = Depends(get_db),
) -> list[ConversationRead]:
    return list_conversations(db)


@router.get("/conversations/history", response_model=ConversationHistoryListResponse)
def get_conversation_history(
    _: object = Depends(require_permissions("conversation.read")),
    db: Session = Depends(get_db),
) -> ConversationHistoryListResponse:
    return ConversationHistoryListResponse(items=list_conversation_history(db))


@router.get("/conversations/{conversation_id}", response_model=ConversationRead)
def get_conversation_detail(
    conversation_id: int,
    _: object = Depends(require_permissions("conversation.read")),
    db: Session = Depends(get_db),
) -> ConversationRead:
    return get_conversation(db, conversation_id)


@router.get("/conversations/{conversation_id}/summary", response_model=ConversationSummaryRead)
def get_conversation_summary_detail(
    conversation_id: int,
    _: object = Depends(require_permissions("conversation.read")),
    db: Session = Depends(get_db),
) -> ConversationSummaryRead:
    summary = get_conversation_summary(db, conversation_id)
    satisfaction = get_satisfaction(db, conversation_id)
    return ConversationSummaryRead(
        conversation_id=summary.conversation_id,
        ai_summary=summary.ai_summary,
        message_count=summary.message_count,
        last_message_at=summary.last_message_at,
        satisfaction_score=satisfaction.score if satisfaction else None,
    )


@router.post("/conversations/{conversation_id}/transfer", response_model=ConversationRead)
def post_transfer(
    conversation_id: int,
    payload: ConversationTransfer,
    _: object = Depends(require_permissions("conversation.write")),
    db: Session = Depends(get_db),
) -> ConversationRead:
    return transfer_conversation(db, conversation_id, payload)


@router.post("/conversations/{conversation_id}/end", response_model=ConversationRead)
def post_end(
    conversation_id: int,
    payload: ConversationEnd,
    _: object = Depends(require_permissions("conversation.write")),
    db: Session = Depends(get_db),
) -> ConversationRead:
    return end_conversation(db, conversation_id, payload)


@router.post("/conversations/{conversation_id}/satisfaction", response_model=SatisfactionRead, status_code=201)
def post_satisfaction(
    conversation_id: int,
    payload: SatisfactionCreate,
    _: object = Depends(require_permissions("conversation.write")),
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


@router.get("/conversations/{conversation_id}/satisfaction", response_model=SatisfactionRead | None)
def get_conversation_satisfaction(
    conversation_id: int,
    _: object = Depends(require_permissions("conversation.read")),
    db: Session = Depends(get_db),
) -> SatisfactionRead | None:
    satisfaction = get_satisfaction(db, conversation_id)
    if satisfaction is None:
        return None
    return SatisfactionRead(
        conversation_id=satisfaction.conversation_id,
        score=satisfaction.score,
        comment=satisfaction.comment,
        created_at=satisfaction.created_at,
        updated_at=satisfaction.updated_at,
    )
