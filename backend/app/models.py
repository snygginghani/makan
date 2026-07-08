import enum
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.config import get_settings

EMBEDDING_DIM = get_settings().embedding_dim


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BanType(str, enum.Enum):
    email = "email"
    ip = "ip"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # Null for Google-only accounts (they have no local password).
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    picture: Mapped[str | None] = mapped_column(String(500))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verify_code: Mapped[str | None] = mapped_column(String(12))
    verify_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Profile (set during onboarding after first sign-in)
    username: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    home_region: Mapped[str | None] = mapped_column(String(80))
    bio: Mapped[str | None] = mapped_column(String(300))
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    # Gamification
    points: Mapped[int] = mapped_column(Integer, default=0, index=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user
    )
    # Moderation: banned mirrors an active email ban for a fast per-request check;
    # last_ip is captured on login so an admin can also ban the account's IP.
    banned: Mapped[bool] = mapped_column(Boolean, default=False)
    last_ip: Mapped[str | None] = mapped_column(String(45))
    # Last location the user shared (e.g. by granting GPS on the map).
    last_lat: Mapped[float | None] = mapped_column(Float)
    last_lng: Mapped[float | None] = mapped_column(Float)
    location_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    favorites: Mapped[list["Favorite"]] = relationship(back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str | None] = mapped_column(String(60))
    color: Mapped[str | None] = mapped_column(String(20))


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    name_ar: Mapped[str] = mapped_column(String(200), index=True)
    name_en: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    # Coordinates seeded programmatically are approximate until verified by an admin.
    coords_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped[str] = mapped_column(String(60), index=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    region: Mapped[str | None] = mapped_column(String(80), index=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    images: Mapped[list[str]] = mapped_column(JSONB, default=list)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    knowledge_base: Mapped["KnowledgeBase | None"] = relationship(
        back_populates="place", cascade="all, delete-orphan", uselist=False
    )
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="place", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_places_lat_lng", "lat", "lng"),)


class KnowledgeBase(Base):
    """One uploaded knowledge JSON document per place (raw form + doc-level embedding)."""

    __tablename__ = "knowledge_base"

    id: Mapped[int] = mapped_column(primary_key=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), unique=True, index=True
    )
    raw_json: Mapped[dict] = mapped_column(JSONB)
    file_path: Mapped[str | None] = mapped_column(String(500))
    embedding_vector: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    place: Mapped[Place] = relationship(back_populates="knowledge_base")


class KnowledgeChunk(Base):
    """RAG retrieval unit: one QA pair (or description/tags chunk) with its embedding."""

    __tablename__ = "knowledge_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), index=True
    )
    kb_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_base.id", ondelete="CASCADE")
    )
    question: Mapped[str | None] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(30), default="qa")  # qa|description|tags
    embedding_vector: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    place: Mapped[Place] = relationship(back_populates="chunks")


class Favorite(Base):
    __tablename__ = "favorites"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="favorites")
    place: Mapped[Place] = relationship()


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    place_json: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus, name="submission_status"),
        default=SubmissionStatus.pending,
        index=True,
    )
    review_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class Review(Base):
    """User rating (1-5) + optional comment; one per user per place."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), index=True
    )
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship()

    __table_args__ = (UniqueConstraint("user_id", "place_id", name="uq_review_user_place"),)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "place_id", "reason", name="uq_report_once"),)


class Ban(Base):
    """A moderation block by email or IP address. Source of truth for bans;
    a matching User row also carries a `banned` flag for the fast per-request check."""

    __tablename__ = "bans"

    id: Mapped[int] = mapped_column(primary_key=True)
    ban_type: Mapped[BanType] = mapped_column(Enum(BanType, name="ban_type"), index=True)
    # email (lowercased) or IP string
    value: Mapped[str] = mapped_column(String(255))
    reason: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (UniqueConstraint("ban_type", "value", name="uq_ban_type_value"),)
