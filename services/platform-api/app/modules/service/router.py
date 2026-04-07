from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.service.crud import (
    create_leave_message,
    create_ticket,
    get_leave_message,
    get_ticket,
    list_leave_messages,
    list_tickets,
    update_leave_message,
    update_ticket,
)
from app.modules.service.models import LeaveMessage, Ticket
from app.modules.service.schemas import (
    LeaveMessageCreate,
    LeaveMessageListResponse,
    LeaveMessageRead,
    LeaveMessageUpdate,
    TicketCreate,
    TicketListResponse,
    TicketRead,
    TicketUpdate,
)

router = APIRouter(prefix="/service", tags=["service"])


class AnalyticsBreakdownRead(BaseModel):
    label: str
    value: int


class ServiceAnalyticsTrendRead(BaseModel):
    date: str
    ticket_count: int
    leave_message_count: int
    open_ticket_count: int
    pending_leave_message_count: int
    average_ticket_age_minutes: float | None
    average_leave_message_age_minutes: float | None


class ServiceAnalyticsDurationRead(BaseModel):
    ticket_count: int
    leave_message_count: int
    open_ticket_average_age_minutes: float | None
    pending_leave_message_average_age_minutes: float | None
    oldest_ticket_age_minutes: float | None
    oldest_leave_message_age_minutes: float | None


class ServiceAnalyticsHitRateRead(BaseModel):
    ticket_assignment_rate: float
    sla_compliance_rate: float
    leave_assignment_rate: float


class ServiceAnalyticsOverviewRead(BaseModel):
    window_days: int
    trend: list[ServiceAnalyticsTrendRead]
    distribution: dict[str, list[AnalyticsBreakdownRead]]
    duration: ServiceAnalyticsDurationRead
    hit_rate: ServiceAnalyticsHitRateRead
    last_refreshed_at: datetime


def _percentage(part: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round((part / total) * 100, 2)


def _bucket_date(value: datetime) -> str:
    return value.astimezone(timezone.utc).date().isoformat()


def _age_minutes(value: datetime, *, now: datetime) -> float:
    return (now - value.astimezone(timezone.utc)).total_seconds() / 60


@router.get("/analytics/overview", response_model=ServiceAnalyticsOverviewRead)
def get_service_analytics_overview(
    window_days: int = 7,
    _: object = Depends(require_permissions("service.read")),
    db: Session = Depends(get_db),
) -> ServiceAnalyticsOverviewRead:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=window_days)
    tickets = list(
        db.scalars(
            select(Ticket).where(or_(Ticket.created_at >= cutoff, Ticket.updated_at >= cutoff))
        ).all()
    )
    leave_messages = list(
        db.scalars(
            select(LeaveMessage).where(or_(LeaveMessage.created_at >= cutoff, LeaveMessage.updated_at >= cutoff))
        ).all()
    )

    ticket_buckets: dict[str, list[Ticket]] = defaultdict(list)
    leave_buckets: dict[str, list[LeaveMessage]] = defaultdict(list)
    for ticket in tickets:
        ticket_buckets[_bucket_date(ticket.created_at)].append(ticket)
    for leave_message in leave_messages:
        leave_buckets[_bucket_date(leave_message.created_at)].append(leave_message)

    trend_dates = sorted({*ticket_buckets.keys(), *leave_buckets.keys()})
    trend: list[ServiceAnalyticsTrendRead] = []
    for day in trend_dates:
        ticket_items = ticket_buckets.get(day, [])
        leave_items = leave_buckets.get(day, [])
        open_ticket_ages = [
            _age_minutes(ticket.created_at, now=now)
            for ticket in ticket_items
            if ticket.status.lower() == "open"
        ]
        pending_leave_ages = [
            _age_minutes(leave_message.created_at, now=now)
            for leave_message in leave_items
            if leave_message.status.lower() == "pending"
        ]
        trend.append(
            ServiceAnalyticsTrendRead(
                date=day,
                ticket_count=len(ticket_items),
                leave_message_count=len(leave_items),
                open_ticket_count=sum(1 for ticket in ticket_items if ticket.status.lower() == "open"),
                pending_leave_message_count=sum(
                    1 for leave_message in leave_items if leave_message.status.lower() == "pending"
                ),
                average_ticket_age_minutes=round(mean(open_ticket_ages), 0) if open_ticket_ages else None,
                average_leave_message_age_minutes=round(mean(pending_leave_ages), 0) if pending_leave_ages else None,
            )
        )

    open_ticket_ages = [
        _age_minutes(ticket.created_at, now=now)
        for ticket in tickets
        if ticket.status.lower() == "open"
    ]
    pending_leave_ages = [
        _age_minutes(leave_message.created_at, now=now)
        for leave_message in leave_messages
        if leave_message.status.lower() == "pending"
    ]

    ticket_status = Counter(ticket.status for ticket in tickets)
    ticket_priority = Counter(ticket.priority for ticket in tickets)
    ticket_source = Counter(ticket.source for ticket in tickets)
    leave_status = Counter(leave_message.status for leave_message in leave_messages)
    leave_source = Counter(leave_message.source for leave_message in leave_messages)

    distribution = {
        "ticket_status": [AnalyticsBreakdownRead(label=label, value=value) for label, value in sorted(ticket_status.items())],
        "ticket_priority": [AnalyticsBreakdownRead(label=label, value=value) for label, value in sorted(ticket_priority.items())],
        "ticket_source": [AnalyticsBreakdownRead(label=label, value=value) for label, value in sorted(ticket_source.items())],
        "leave_message_status": [
            AnalyticsBreakdownRead(label=label, value=value) for label, value in sorted(leave_status.items())
        ],
        "leave_message_source": [
            AnalyticsBreakdownRead(label=label, value=value) for label, value in sorted(leave_source.items())
        ],
    }

    return ServiceAnalyticsOverviewRead(
        window_days=window_days,
        trend=trend,
        distribution=distribution,
        duration=ServiceAnalyticsDurationRead(
            ticket_count=len(tickets),
            leave_message_count=len(leave_messages),
            open_ticket_average_age_minutes=round(mean(open_ticket_ages), 0) if open_ticket_ages else None,
            pending_leave_message_average_age_minutes=round(mean(pending_leave_ages), 0) if pending_leave_ages else None,
            oldest_ticket_age_minutes=round(max(open_ticket_ages), 0) if open_ticket_ages else None,
            oldest_leave_message_age_minutes=round(max(pending_leave_ages), 0) if pending_leave_ages else None,
        ),
        hit_rate=ServiceAnalyticsHitRateRead(
            ticket_assignment_rate=_percentage(
                sum(1 for ticket in tickets if ticket.assignee or ticket.assignee_group),
                len(tickets),
            ),
            sla_compliance_rate=_percentage(
                sum(1 for ticket in tickets if ticket.status.lower() in {"resolved", "closed", "done", "completed"}),
                len(tickets),
            ),
            leave_assignment_rate=_percentage(
                sum(1 for leave_message in leave_messages if leave_message.assigned_group),
                len(leave_messages),
            ),
        ),
        last_refreshed_at=now,
    )


@router.post("/tickets", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def post_ticket(
    payload: TicketCreate,
    _: object = Depends(require_permissions("service.write")),
    db: Session = Depends(get_db),
) -> TicketRead:
    return create_ticket(db, payload)


@router.get("/tickets", response_model=TicketListResponse)
def get_tickets(
    _: object = Depends(require_permissions("service.read")),
    db: Session = Depends(get_db),
) -> TicketListResponse:
    return TicketListResponse(items=list_tickets(db))


@router.get("/tickets/{ticket_id}", response_model=TicketRead)
def get_ticket_detail(
    ticket_id: int,
    _: object = Depends(require_permissions("service.read")),
    db: Session = Depends(get_db),
) -> TicketRead:
    return get_ticket(db, ticket_id)


@router.patch("/tickets/{ticket_id}", response_model=TicketRead)
def patch_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    _: object = Depends(require_permissions("service.write")),
    db: Session = Depends(get_db),
) -> TicketRead:
    return update_ticket(db, ticket_id, payload)


@router.post("/leave-messages", response_model=LeaveMessageRead, status_code=status.HTTP_201_CREATED)
def post_leave_message(
    payload: LeaveMessageCreate,
    _: object = Depends(require_permissions("service.write")),
    db: Session = Depends(get_db),
) -> LeaveMessageRead:
    return create_leave_message(db, payload)


@router.get("/leave-messages", response_model=LeaveMessageListResponse)
def get_leave_messages(
    _: object = Depends(require_permissions("service.read")),
    db: Session = Depends(get_db),
) -> LeaveMessageListResponse:
    return LeaveMessageListResponse(items=list_leave_messages(db))


@router.get("/leave-messages/{leave_message_id}", response_model=LeaveMessageRead)
def get_leave_message_detail(
    leave_message_id: int,
    _: object = Depends(require_permissions("service.read")),
    db: Session = Depends(get_db),
) -> LeaveMessageRead:
    return get_leave_message(db, leave_message_id)


@router.patch("/leave-messages/{leave_message_id}", response_model=LeaveMessageRead)
def patch_leave_message(
    leave_message_id: int,
    payload: LeaveMessageUpdate,
    _: object = Depends(require_permissions("service.write")),
    db: Session = Depends(get_db),
) -> LeaveMessageRead:
    return update_leave_message(db, leave_message_id, payload)
