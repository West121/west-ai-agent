from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

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
from app.modules.conversation.models import Conversation, ConversationEvent
from app.modules.conversation.models import ConversationSummary, SatisfactionRecord
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


class AnalyticsBreakdownRead(BaseModel):
    label: str
    value: int


class AnalyticsTrendRead(BaseModel):
    date: str
    created_count: int
    ended_count: int
    transferred_count: int
    average_duration_minutes: float | None
    summary_coverage_rate: float
    satisfaction_coverage_rate: float


class AnalyticsDurationRead(BaseModel):
    count: int
    average_minutes: float | None
    max_minutes: float | None


class AnalyticsHitRateRead(BaseModel):
    summary_coverage_rate: float
    satisfaction_coverage_rate: float
    satisfaction_high_score_rate: float


class ConversationAnalyticsOverviewRead(BaseModel):
    window_days: int
    trend: list[AnalyticsTrendRead]
    status_distribution: list[AnalyticsBreakdownRead]
    channel_distribution: list[AnalyticsBreakdownRead]
    duration: AnalyticsDurationRead
    hit_rate: AnalyticsHitRateRead
    last_refreshed_at: datetime


def _percentage(part: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round((part / total) * 100, 2)


def _bucket_date(value: datetime) -> str:
    return value.astimezone(timezone.utc).date().isoformat()


@router.get("/analytics/overview", response_model=ConversationAnalyticsOverviewRead)
def get_conversation_analytics_overview(
    window_days: int = 7,
    channel: str | None = Query(default=None),
    status: str | None = Query(default=None),
    _: object = Depends(require_permissions("conversation.read")),
    db: Session = Depends(get_db),
) -> ConversationAnalyticsOverviewRead:
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    conversations = list(
        db.scalars(
            select(Conversation)
            .where(or_(Conversation.created_at >= cutoff, Conversation.ended_at >= cutoff))
            .options(selectinload(Conversation.summary), selectinload(Conversation.satisfaction))
        ).all()
    )
    if channel is not None:
        conversations = [conversation for conversation in conversations if conversation.channel.lower() == channel.lower()]
    if status is not None:
        conversations = [conversation for conversation in conversations if conversation.status.lower() == status.lower()]
    conversation_ids = [conversation.id for conversation in conversations]
    summary_count = (
        db.scalar(select(func.count(ConversationSummary.id)).where(ConversationSummary.conversation_id.in_(conversation_ids)))
        if conversation_ids
        else 0
    ) or 0
    satisfaction_count = (
        db.scalar(
            select(func.count(SatisfactionRecord.id)).where(SatisfactionRecord.conversation_id.in_(conversation_ids))
        )
        if conversation_ids
        else 0
    ) or 0
    satisfaction_records = list(
        db.scalars(
            select(SatisfactionRecord).where(SatisfactionRecord.conversation_id.in_(conversation_ids))
        ).all()
    )
    transferred_query = select(ConversationEvent).where(
        ConversationEvent.event_type == "transferred",
        ConversationEvent.created_at >= cutoff,
    )
    if conversation_ids:
        transferred_query = transferred_query.where(ConversationEvent.conversation_id.in_(conversation_ids))
    transferred_events = list(db.scalars(transferred_query).all())

    created_buckets: dict[str, list[Conversation]] = defaultdict(list)
    ended_buckets: dict[str, list[Conversation]] = defaultdict(list)
    transfer_counts: Counter[str] = Counter()

    for conversation in conversations:
        if conversation.created_at is not None:
            created_buckets[_bucket_date(conversation.created_at)].append(conversation)
        if conversation.ended_at is not None:
            ended_buckets[_bucket_date(conversation.ended_at)].append(conversation)

    for event in transferred_events:
        transfer_counts[_bucket_date(event.created_at)] += 1

    trend_dates = sorted({*created_buckets.keys(), *ended_buckets.keys(), *transfer_counts.keys()})
    trend: list[AnalyticsTrendRead] = []
    for day in trend_dates:
        created_items = created_buckets.get(day, [])
        ended_items = ended_buckets.get(day, [])
        durations = [
            (conversation.ended_at - conversation.created_at).total_seconds() / 60
            for conversation in ended_items
            if conversation.ended_at is not None and conversation.created_at is not None
        ]
        trend.append(
            AnalyticsTrendRead(
                date=day,
                created_count=len(created_items),
                ended_count=len(ended_items),
                transferred_count=transfer_counts.get(day, 0),
                average_duration_minutes=round(mean(durations), 0) if durations else None,
                summary_coverage_rate=_percentage(
                    sum(1 for conversation in created_items if conversation.summary is not None),
                    len(created_items),
                ),
                satisfaction_coverage_rate=_percentage(
                    sum(1 for conversation in created_items if conversation.satisfaction is not None),
                    len(created_items),
                ),
            )
        )

    durations = [
        (conversation.ended_at - conversation.created_at).total_seconds() / 60
        for conversation in conversations
        if conversation.ended_at is not None and conversation.created_at is not None
    ]
    status_distribution = [
        AnalyticsBreakdownRead(label=label, value=value)
        for label, value in sorted(Counter(conversation.status for conversation in conversations).items())
    ]
    channel_distribution = [
        AnalyticsBreakdownRead(label=label, value=value)
        for label, value in sorted(Counter(conversation.channel for conversation in conversations).items())
    ]

    return ConversationAnalyticsOverviewRead(
        window_days=window_days,
        trend=trend,
        status_distribution=status_distribution,
        channel_distribution=channel_distribution,
        duration=AnalyticsDurationRead(
            count=len(durations),
            average_minutes=round(mean(durations), 0) if durations else None,
            max_minutes=round(max(durations), 0) if durations else None,
        ),
        hit_rate=AnalyticsHitRateRead(
            summary_coverage_rate=_percentage(summary_count, len(conversations)),
            satisfaction_coverage_rate=_percentage(satisfaction_count, len(conversations)),
            satisfaction_high_score_rate=_percentage(
                sum(1 for record in satisfaction_records if record.score >= 4),
                len(satisfaction_records),
            ),
        ),
        last_refreshed_at=datetime.now(timezone.utc),
    )


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
