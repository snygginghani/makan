from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models import (
    Favorite,
    Place,
    Report,
    Review,
    Submission,
    SubmissionStatus,
    User,
)
from app.schemas import (
    LeaderboardEntry,
    LocationIn,
    OnboardingIn,
    PlaceOut,
    ReportCreate,
    ReportOut,
    SubmissionCreate,
    SubmissionOut,
    UserOut,
    UserStats,
)
from app.services.media import MediaError, save_image
from app.services.points import POINTS_SUGGESTION, award

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_profile(
    payload: OnboardingIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    """Set username + profile (used by the onboarding flow). Marks onboarded."""
    clash = await db.scalar(
        select(User).where(
            func.lower(User.username) == payload.username.lower(), User.id != user.id
        )
    )
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "اسم المستخدم مستخدم / username is taken")
    user.username = payload.username
    user.home_region = payload.home_region
    user.bio = payload.bio
    user.onboarded = True
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/me/location", status_code=status.HTTP_204_NO_CONTENT)
async def report_location(
    payload: LocationIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Record the user's last shared location (sent when they grant GPS on the map)."""
    from datetime import datetime, timezone

    user.last_lat = payload.lat
    user.last_lng = payload.lng
    user.location_at = datetime.now(timezone.utc)
    await db.commit()


@router.get("/me/stats", response_model=UserStats)
async def my_stats(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> UserStats:
    reviews = await db.scalar(select(func.count(Review.id)).where(Review.user_id == user.id)) or 0
    favorites = (
        await db.scalar(select(func.count()).select_from(Favorite).where(Favorite.user_id == user.id))
        or 0
    )
    submissions = (
        await db.scalar(select(func.count(Submission.id)).where(Submission.user_id == user.id)) or 0
    )
    approved = (
        await db.scalar(
            select(func.count(Submission.id)).where(
                Submission.user_id == user.id,
                Submission.status == SubmissionStatus.approved,
            )
        )
        or 0
    )
    total_contributors = await db.scalar(select(func.count(User.id)).where(User.points > 0)) or 0
    ahead = await db.scalar(select(func.count(User.id)).where(User.points > user.points)) or 0
    return UserStats(
        points=user.points,
        rank=ahead + 1,
        total_contributors=total_contributors,
        reviews_count=reviews,
        favorites_count=favorites,
        submissions_count=submissions,
        approved_count=approved,
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> list[LeaderboardEntry]:
    rows = (
        await db.scalars(
            select(User).where(User.points > 0).order_by(User.points.desc(), User.id).limit(limit)
        )
    ).all()
    return [
        LeaderboardEntry(
            rank=i + 1,
            id=u.id,
            name=u.username or u.name,
            username=u.username,
            picture=u.picture,
            points=u.points,
            is_me=user is not None and u.id == user.id,
        )
        for i, u in enumerate(rows)
    ]


@router.get("/me/favorites", response_model=list[PlaceOut])
async def my_favorites(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> list[PlaceOut]:
    rows = (
        await db.scalars(
            select(Place)
            .join(Favorite, Favorite.place_id == Place.id)
            .where(Favorite.user_id == user.id, Place.approved.is_(True))
            .order_by(Favorite.created_at.desc())
        )
    ).all()
    return [PlaceOut.model_validate(p) for p in rows]


@router.post("/uploads/images", response_model=list[str], status_code=status.HTTP_201_CREATED)
async def upload_suggestion_images(
    files: list[UploadFile],
    user: User = Depends(get_current_user),
) -> list[str]:
    """Authenticated users upload photos for their place suggestions;
    returned URLs go into the submission's place_json.images."""
    if len(files) > 5:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "5 صور كحد أقصى")
    urls: list[str] = []
    for file in files:
        try:
            urls.append(await save_image(f"suggestions/{user.id}", file))
        except MediaError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    return urls


@router.post("/submissions", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
async def submit_place(
    payload: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubmissionOut:
    """Community place suggestion; goes to admin review before becoming a Place."""
    submission = Submission(user_id=user.id, place_json=payload.place_json.model_dump(mode="json"))
    db.add(submission)
    await award(db, user.id, POINTS_SUGGESTION)  # points for contributing
    await db.commit()
    await db.refresh(submission)
    return SubmissionOut.model_validate(submission)


@router.get("/submissions/mine", response_model=list[SubmissionOut])
async def my_submissions(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> list[SubmissionOut]:
    rows = (
        await db.scalars(
            select(Submission)
            .where(Submission.user_id == user.id)
            .order_by(Submission.created_at.desc())
        )
    ).all()
    return [SubmissionOut.model_validate(s) for s in rows]


@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def report_place(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportOut:
    place = await db.get(Place, payload.place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    existing = await db.scalar(
        select(Report).where(
            Report.user_id == user.id,
            Report.place_id == payload.place_id,
            Report.reason == payload.reason,
        )
    )
    if existing:
        return ReportOut.model_validate(existing)
    report = Report(user_id=user.id, place_id=payload.place_id, reason=payload.reason)
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return ReportOut.model_validate(report)
