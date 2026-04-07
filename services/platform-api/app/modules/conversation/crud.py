from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.conversation.models import Conversation, ConversationEvent, ConversationSummary, SatisfactionRecord
from app.modules.conversation.schemas import ConversationCreate, ConversationEnd, ConversationTransfer, SatisfactionCreate
from app.modules.customer.crud import _load_customer


def _not_found(conversation_id: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"conversation {conversation_id} not found")


def _load_conversation(db: Session, conversation_id: int) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise _not_found(conversation_id)
    return conversation


def _load_summary(db: Session, conversation_id: int) -> ConversationSummary | None:
    return db.scalars(
        select(ConversationSummary).where(ConversationSummary.conversation_id == conversation_id)
    ).first()


def _load_satisfaction(db: Session, conversation_id: int) -> SatisfactionRecord | None:
    return db.scalars(
        select(SatisfactionRecord).where(SatisfactionRecord.conversation_id == conversation_id)
    ).first()


def _add_event(
    db: Session,
    conversation_id: int,
    event_type: str,
    *,
    from_assignee: str | None = None,
    to_assignee: str | None = None,
    reason: str | None = None,
) -> ConversationEvent:
    event = ConversationEvent(
        conversation_id=conversation_id,
        event_type=event_type,
        from_assignee=from_assignee,
        to_assignee=to_assignee,
        reason=reason,
    )
    db.add(event)
    return event


def create_conversation(db: Session, data: ConversationCreate) -> Conversation:
    _load_customer(db, data.customer_profile_id)
    conversation = Conversation(
        customer_profile_id=data.customer_profile_id,
        channel=data.channel,
        assignee=data.assignee,
        status="open",
    )
    db.add(conversation)
    db.flush()
    _add_event(db, conversation.id, "created", to_assignee=data.assignee)
    db.add(
        ConversationSummary(
            conversation_id=conversation.id,
            ai_summary="会话已创建，等待首条消息进入。",
            message_count=1,
        )
    )
    db.commit()
    db.refresh(conversation)
    return conversation


def list_conversations(db: Session) -> list[Conversation]:
    stmt = select(Conversation).options(selectinload(Conversation.events)).order_by(Conversation.id)
    return list(db.scalars(stmt).all())


def get_conversation(db: Session, conversation_id: int) -> Conversation:
    stmt = select(Conversation).options(selectinload(Conversation.events)).where(Conversation.id == conversation_id)
    conversation = db.scalars(stmt).first()
    if conversation is None:
        raise _not_found(conversation_id)
    return conversation


def get_conversation_summary(db: Session, conversation_id: int) -> ConversationSummary:
    conversation = get_conversation(db, conversation_id)
    summary = _load_summary(db, conversation_id)
    if summary is None:
        summary = ConversationSummary(
            conversation_id=conversation.id,
            ai_summary="暂无摘要",
            message_count=max(len(conversation.events), 1),
            last_message_at=conversation.updated_at,
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)
    return summary


def list_conversation_history(db: Session) -> list[dict[str, object]]:
    conversations = list_conversations(db)
    items: list[dict[str, object]] = []
    for conversation in sorted(conversations, key=lambda item: item.updated_at, reverse=True):
        summary = _load_summary(db, conversation.id)
        satisfaction = _load_satisfaction(db, conversation.id)
        items.append(
            {
                "id": conversation.id,
                "customer_profile_id": conversation.customer_profile_id,
                "status": conversation.status,
                "assignee": conversation.assignee,
                "channel": conversation.channel,
                "summary": summary.ai_summary if summary else "暂无摘要",
                "last_message_at": summary.last_message_at if summary else conversation.updated_at,
                "created_at": conversation.created_at,
                "ended_at": conversation.ended_at,
                "satisfaction_score": satisfaction.score if satisfaction else None,
            }
        )
    return items


def transfer_conversation(db: Session, conversation_id: int, data: ConversationTransfer) -> Conversation:
    conversation = _load_conversation(db, conversation_id)
    if conversation.status == "ended":
        raise HTTPException(status_code=409, detail="conversation is already ended")
    previous_assignee = conversation.assignee
    conversation.assignee = data.assignee
    conversation.status = "transferred"
    _add_event(
        db,
        conversation.id,
        "transferred",
        from_assignee=previous_assignee,
        to_assignee=data.assignee,
        reason=data.reason,
    )
    db.commit()
    db.refresh(conversation)
    return conversation


def end_conversation(db: Session, conversation_id: int, data: ConversationEnd) -> Conversation:
    conversation = _load_conversation(db, conversation_id)
    if conversation.status == "ended":
        raise HTTPException(status_code=409, detail="conversation is already ended")
    conversation.status = "ended"
    from datetime import datetime, timezone

    conversation.ended_at = datetime.now(timezone.utc)
    _add_event(db, conversation.id, "ended", from_assignee=conversation.assignee, reason=data.reason)
    summary = _load_summary(db, conversation.id)
    if summary is not None:
        summary.ai_summary = data.reason or summary.ai_summary
        summary.last_message_at = conversation.ended_at
    db.commit()
    db.refresh(conversation)
    return conversation


def upsert_satisfaction(db: Session, conversation_id: int, data: SatisfactionCreate) -> SatisfactionRecord:
    _load_conversation(db, conversation_id)
    satisfaction = _load_satisfaction(db, conversation_id)
    if satisfaction is None:
        satisfaction = SatisfactionRecord(conversation_id=conversation_id, score=data.score, comment=data.comment)
        db.add(satisfaction)
    else:
        satisfaction.score = data.score
        satisfaction.comment = data.comment
    db.commit()
    db.refresh(satisfaction)
    return satisfaction


def get_satisfaction(db: Session, conversation_id: int) -> SatisfactionRecord | None:
    _load_conversation(db, conversation_id)
    return _load_satisfaction(db, conversation_id)
