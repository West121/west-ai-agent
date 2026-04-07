from __future__ import annotations

from collections.abc import Iterable

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.customer.models import BlacklistEntry, CustomerProfile, Tag
from app.modules.customer.schemas import BlacklistCreate, BlacklistUpdate, CustomerProfileCreate, CustomerProfileUpdate, TagCreate, TagUpdate


def _not_found(resource: str, identifier: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} {identifier} not found")


def _load_customer(db: Session, customer_id: int) -> CustomerProfile:
    customer = db.get(CustomerProfile, customer_id)
    if customer is None:
        raise _not_found("customer profile", customer_id)
    return customer


def _load_tag(db: Session, tag_id: int) -> Tag:
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise _not_found("tag", tag_id)
    return tag


def _load_blacklist(db: Session, blacklist_id: int) -> BlacklistEntry:
    entry = db.get(BlacklistEntry, blacklist_id)
    if entry is None:
        raise _not_found("blacklist entry", blacklist_id)
    return entry


def create_tag(db: Session, data: TagCreate) -> Tag:
    tag = Tag(name=data.name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def list_tags(db: Session) -> list[Tag]:
    return list(db.scalars(select(Tag).order_by(Tag.id)).all())


def get_tag(db: Session, tag_id: int) -> Tag:
    return _load_tag(db, tag_id)


def update_tag(db: Session, tag_id: int, data: TagUpdate) -> Tag:
    tag = _load_tag(db, tag_id)
    if data.name is not None:
        tag.name = data.name
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, tag_id: int) -> None:
    tag = _load_tag(db, tag_id)
    db.delete(tag)
    db.commit()


def create_customer_profile(db: Session, data: CustomerProfileCreate) -> CustomerProfile:
    customer = CustomerProfile(
        external_id=data.external_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        status=data.status,
    )
    if data.tag_ids:
        customer.tags = [_load_tag(db, tag_id) for tag_id in data.tag_ids]
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def list_customer_profiles(db: Session) -> list[CustomerProfile]:
    stmt = select(CustomerProfile).options(selectinload(CustomerProfile.tags)).order_by(CustomerProfile.id)
    return list(db.scalars(stmt).all())


def get_customer_profile(db: Session, customer_id: int) -> CustomerProfile:
    stmt = select(CustomerProfile).options(selectinload(CustomerProfile.tags)).where(CustomerProfile.id == customer_id)
    customer = db.scalars(stmt).first()
    if customer is None:
        raise _not_found("customer profile", customer_id)
    return customer


def update_customer_profile(db: Session, customer_id: int, data: CustomerProfileUpdate) -> CustomerProfile:
    customer = _load_customer(db, customer_id)
    if data.external_id is not None:
        customer.external_id = data.external_id
    if data.name is not None:
        customer.name = data.name
    if data.email is not None:
        customer.email = data.email
    if data.phone is not None:
        customer.phone = data.phone
    if data.status is not None:
        customer.status = data.status
    if data.tag_ids is not None:
        customer.tags = [_load_tag(db, tag_id) for tag_id in data.tag_ids]
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer_profile(db: Session, customer_id: int) -> None:
    customer = _load_customer(db, customer_id)
    db.delete(customer)
    db.commit()


def create_blacklist_entry(db: Session, data: BlacklistCreate) -> BlacklistEntry:
    if data.customer_profile_id is not None:
        _load_customer(db, data.customer_profile_id)
    entry = BlacklistEntry(customer_profile_id=data.customer_profile_id, value=data.value, reason=data.reason)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_blacklist_entries(db: Session) -> list[BlacklistEntry]:
    return list(db.scalars(select(BlacklistEntry).order_by(BlacklistEntry.id)).all())


def get_blacklist_entry(db: Session, blacklist_id: int) -> BlacklistEntry:
    return _load_blacklist(db, blacklist_id)


def update_blacklist_entry(db: Session, blacklist_id: int, data: BlacklistUpdate) -> BlacklistEntry:
    entry = _load_blacklist(db, blacklist_id)
    if data.customer_profile_id is not None:
        _load_customer(db, data.customer_profile_id)
        entry.customer_profile_id = data.customer_profile_id
    if data.value is not None:
        entry.value = data.value
    if data.reason is not None:
        entry.reason = data.reason
    db.commit()
    db.refresh(entry)
    return entry


def delete_blacklist_entry(db: Session, blacklist_id: int) -> None:
    entry = _load_blacklist(db, blacklist_id)
    db.delete(entry)
    db.commit()

