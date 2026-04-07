from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
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


@router.post("/tickets", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def post_ticket(payload: TicketCreate, db: Session = Depends(get_db)) -> TicketRead:
    return create_ticket(db, payload)


@router.get("/tickets", response_model=TicketListResponse)
def get_tickets(db: Session = Depends(get_db)) -> TicketListResponse:
    return TicketListResponse(items=list_tickets(db))


@router.get("/tickets/{ticket_id}", response_model=TicketRead)
def get_ticket_detail(ticket_id: int, db: Session = Depends(get_db)) -> TicketRead:
    return get_ticket(db, ticket_id)


@router.patch("/tickets/{ticket_id}", response_model=TicketRead)
def patch_ticket(ticket_id: int, payload: TicketUpdate, db: Session = Depends(get_db)) -> TicketRead:
    return update_ticket(db, ticket_id, payload)


@router.post("/leave-messages", response_model=LeaveMessageRead, status_code=status.HTTP_201_CREATED)
def post_leave_message(payload: LeaveMessageCreate, db: Session = Depends(get_db)) -> LeaveMessageRead:
    return create_leave_message(db, payload)


@router.get("/leave-messages", response_model=LeaveMessageListResponse)
def get_leave_messages(db: Session = Depends(get_db)) -> LeaveMessageListResponse:
    return LeaveMessageListResponse(items=list_leave_messages(db))


@router.get("/leave-messages/{leave_message_id}", response_model=LeaveMessageRead)
def get_leave_message_detail(leave_message_id: int, db: Session = Depends(get_db)) -> LeaveMessageRead:
    return get_leave_message(db, leave_message_id)


@router.patch("/leave-messages/{leave_message_id}", response_model=LeaveMessageRead)
def patch_leave_message(
    leave_message_id: int,
    payload: LeaveMessageUpdate,
    db: Session = Depends(get_db),
) -> LeaveMessageRead:
    return update_leave_message(db, leave_message_id, payload)
