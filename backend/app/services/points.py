"""Contribution points. Kept intentionally simple: an integer counter on the
user, incremented at the moment a contribution happens."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

# Point values per contribution type.
POINTS_REVIEW = 10  # first review on a place
POINTS_SUGGESTION = 10  # submitting a place suggestion
POINTS_SUGGESTION_APPROVED = 40  # bonus when an admin approves it


async def award(db: AsyncSession, user_id: int, amount: int) -> None:
    """Add points to a user (no-op for amount <= 0). Caller commits."""
    if amount <= 0:
        return
    user = await db.get(User, user_id)
    if user is not None:
        user.points = (user.points or 0) + amount


def level_for(points: int) -> int:
    """Simple level curve: every 100 points is a level (level starts at 1)."""
    return 1 + points // 100
