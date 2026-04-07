from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, relationship

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


customer_tag_links = Table(
    "customer_tag_links",
    Base.metadata,
    Column("customer_profile_id", ForeignKey("customer_profiles.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("customer_tags.id", ondelete="CASCADE"), primary_key=True),
)


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    external_id: Mapped[str] = Column(String(128), unique=True, nullable=False, index=True)
    name: Mapped[str] = Column(String(255), nullable=False)
    email: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = Column(String(64), nullable=True, index=True)
    status: Mapped[str] = Column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=customer_tag_links,
        back_populates="customers",
        lazy="selectin",
    )
    blacklist_entries: Mapped[list["BlacklistEntry"]] = relationship(
        "BlacklistEntry",
        back_populates="customer_profile",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Tag(Base):
    __tablename__ = "customer_tags"
    __table_args__ = (UniqueConstraint("name", name="uq_customer_tags_name"),)

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    name: Mapped[str] = Column(String(128), nullable=False)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    customers: Mapped[list[CustomerProfile]] = relationship(
        "CustomerProfile",
        secondary=customer_tag_links,
        back_populates="tags",
        lazy="selectin",
    )


class BlacklistEntry(Base):
    __tablename__ = "customer_blacklist_entries"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    customer_profile_id: Mapped[int | None] = Column(
        Integer,
        ForeignKey("customer_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    value: Mapped[str] = Column(String(255), nullable=False, index=True)
    reason: Mapped[str | None] = Column(Text, nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    customer_profile: Mapped[CustomerProfile | None] = relationship("CustomerProfile", back_populates="blacklist_entries")

