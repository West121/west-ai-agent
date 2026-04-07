from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.conversation.crud import _load_conversation
from app.modules.customer.crud import _load_customer
from app.modules.service.models import LeaveMessage, Ticket
from app.modules.service.schemas import LeaveMessageCreate, LeaveMessageUpdate, TicketCreate, TicketUpdate


def _not_found(resource: str, identifier: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} {identifier} not found")


def _load_ticket(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise _not_found("ticket", ticket_id)
    return ticket


def _load_leave_message(db: Session, leave_message_id: int) -> LeaveMessage:
    leave_message = db.get(LeaveMessage, leave_message_id)
    if leave_message is None:
        raise _not_found("leave message", leave_message_id)
    return leave_message


def create_ticket(db: Session, data: TicketCreate) -> Ticket:
    if data.customer_profile_id is not None:
        _load_customer(db, data.customer_profile_id)
    if data.conversation_id is not None:
        _load_conversation(db, data.conversation_id)

    ticket = Ticket(**data.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def list_tickets(db: Session) -> list[Ticket]:
    return list(db.scalars(select(Ticket).order_by(Ticket.updated_at.desc(), Ticket.id.desc())).all())


def get_ticket(db: Session, ticket_id: int) -> Ticket:
    return _load_ticket(db, ticket_id)


def update_ticket(db: Session, ticket_id: int, data: TicketUpdate) -> Ticket:
    ticket = _load_ticket(db, ticket_id)
    payload = data.model_dump(exclude_unset=True)
    if "customer_profile_id" in payload and payload["customer_profile_id"] is not None:
        _load_customer(db, payload["customer_profile_id"])
    if "conversation_id" in payload and payload["conversation_id"] is not None:
        _load_conversation(db, payload["conversation_id"])
    for key, value in payload.items():
        setattr(ticket, key, value)
    db.commit()
    db.refresh(ticket)
    return ticket


def create_leave_message(db: Session, data: LeaveMessageCreate) -> LeaveMessage:
    leave_message = LeaveMessage(**data.model_dump())
    db.add(leave_message)
    db.commit()
    db.refresh(leave_message)
    return leave_message


def list_leave_messages(db: Session) -> list[LeaveMessage]:
    return list(
        db.scalars(select(LeaveMessage).order_by(LeaveMessage.updated_at.desc(), LeaveMessage.id.desc())).all()
    )


def get_leave_message(db: Session, leave_message_id: int) -> LeaveMessage:
    return _load_leave_message(db, leave_message_id)


def update_leave_message(db: Session, leave_message_id: int, data: LeaveMessageUpdate) -> LeaveMessage:
    leave_message = _load_leave_message(db, leave_message_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(leave_message, key, value)
    db.commit()
    db.refresh(leave_message)
    return leave_message
