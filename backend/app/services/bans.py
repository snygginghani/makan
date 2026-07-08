"""Ban lookups + mutations.

IP bans are enforced in a middleware on every request, so we keep a tiny
in-process cache (short TTL, plus explicit invalidation on change) to avoid a
DB round-trip per request. Email bans are cheap to check because the user row
is already loaded, but they share the same cache for the login path.
"""

import time

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Ban, BanType, User

_CACHE_TTL = 30.0
_cache: dict = {"ts": 0.0, "ips": set(), "emails": set()}


async def _refresh(db: AsyncSession) -> None:
    rows = (await db.execute(select(Ban.ban_type, Ban.value))).all()
    _cache["ips"] = {v for t, v in rows if t == BanType.ip}
    _cache["emails"] = {v.lower() for t, v in rows if t == BanType.email}
    _cache["ts"] = time.monotonic()


async def _ensure(db: AsyncSession) -> None:
    if time.monotonic() - _cache["ts"] > _CACHE_TTL:
        await _refresh(db)


def invalidate() -> None:
    """Force the next lookup to re-read from the DB (call after any change)."""
    _cache["ts"] = 0.0


async def is_ip_banned(db: AsyncSession, ip: str) -> bool:
    if not ip:
        return False
    await _ensure(db)
    return ip in _cache["ips"]


async def is_email_banned(db: AsyncSession, email: str) -> bool:
    if not email:
        return False
    await _ensure(db)
    return email.lower() in _cache["emails"]


async def add_ban(
    db: AsyncSession,
    ban_type: BanType,
    value: str,
    reason: str | None,
    created_by: int | None,
) -> Ban:
    """Create a ban (idempotent on type+value) and sync the user's fast flag."""
    value = value.strip()
    if ban_type is BanType.email:
        value = value.lower()

    ban = await db.scalar(
        select(Ban).where(Ban.ban_type == ban_type, Ban.value == value)
    )
    if ban is None:
        ban = Ban(ban_type=ban_type, value=value, reason=reason, created_by=created_by)
        db.add(ban)
    else:
        ban.reason = reason

    if ban_type is BanType.email:
        user = await db.scalar(select(User).where(User.email == value))
        if user is not None:
            user.banned = True

    await db.commit()
    await db.refresh(ban)
    invalidate()
    return ban


async def remove_ban(db: AsyncSession, ban: Ban) -> None:
    """Delete a ban and clear the user's fast flag when it was an email ban."""
    ban_type, value = ban.ban_type, ban.value
    await db.delete(ban)
    if ban_type is BanType.email:
        user = await db.scalar(select(User).where(User.email == value))
        if user is not None:
            user.banned = False
    await db.commit()
    invalidate()


async def remove_ban_by_value(db: AsyncSession, ban_type: BanType, value: str) -> None:
    if ban_type is BanType.email:
        value = value.lower()
    await db.execute(
        delete(Ban).where(Ban.ban_type == ban_type, Ban.value == value)
    )
    if ban_type is BanType.email:
        user = await db.scalar(select(User).where(User.email == value))
        if user is not None:
            user.banned = False
    await db.commit()
    invalidate()
