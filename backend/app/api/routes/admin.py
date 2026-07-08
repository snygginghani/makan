from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db.session import get_db
from app.models import (
    Ban,
    BanType,
    Category,
    KnowledgeBase,
    KnowledgeChunk,
    Place,
    Report,
    Submission,
    SubmissionStatus,
    User,
)
from app.schemas import (
    AdminUserOut,
    AnalyticsOut,
    BanCreateIn,
    BanOut,
    CategoryIn,
    CategoryOut,
    PlaceBase,
    PlaceOut,
    ReportOut,
    RoleUpdateIn,
    SubmissionOut,
    SubmissionReviewIn,
    UserBanIn,
)
from app.models import UserRole
from app.services import bans
from app.services.knowledge import index_place_metadata
from app.services.points import POINTS_SUGGESTION_APPROVED, award

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------- users


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[AdminUserOut]:
    """All registered users with their profile (admin browse)."""
    stmt = select(User).order_by(User.points.desc(), User.id)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            func.lower(User.name).ilike(pattern.lower())
            | func.lower(User.email).ilike(pattern.lower())
            | func.lower(func.coalesce(User.username, "")).ilike(pattern.lower())
        )
    rows = (await db.scalars(stmt)).all()
    return [AdminUserOut.model_validate(u) for u in rows]


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
async def set_user_role(
    user_id: int,
    payload: RoleUpdateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserOut:
    """Promote a user to admin or demote back to a regular user."""
    if user_id == admin.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "لا يمكنك تغيير دورك بنفسك / can't change your own role"
        )
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.role = UserRole(payload.role)
    await db.commit()
    await db.refresh(user)
    return AdminUserOut.model_validate(user)


# ---------------------------------------------------------------- bans


def _guard_ban_target(admin: User, user: User) -> None:
    """An admin can't ban themselves or another admin (avoids lockout)."""
    if user.id == admin.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "لا يمكنك حظر نفسك / you can't ban yourself"
        )
    if user.role == UserRole.admin:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "لا يمكن حظر مشرف — أزل الإشراف أولاً / demote the admin first",
        )


@router.post("/users/{user_id}/ban", response_model=AdminUserOut)
async def ban_user(
    user_id: int,
    payload: UserBanIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserOut:
    """Ban a user by email (and optionally by their last-known IP)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    _guard_ban_target(admin, user)

    await bans.add_ban(db, BanType.email, user.email, payload.reason, admin.id)
    if payload.include_ip and user.last_ip:
        await bans.add_ban(db, BanType.ip, user.last_ip, payload.reason, admin.id)

    await db.refresh(user)
    return AdminUserOut.model_validate(user)


@router.post("/users/{user_id}/unban", response_model=AdminUserOut)
async def unban_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserOut:
    """Lift a user's email ban (and their last-known IP ban, if any)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    await bans.remove_ban_by_value(db, BanType.email, user.email)
    if user.last_ip:
        await bans.remove_ban_by_value(db, BanType.ip, user.last_ip)

    await db.refresh(user)
    return AdminUserOut.model_validate(user)


@router.get("/bans", response_model=list[BanOut])
async def list_bans(
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> list[BanOut]:
    rows = (await db.scalars(select(Ban).order_by(Ban.created_at.desc()))).all()
    return [BanOut.model_validate(b) for b in rows]


@router.post("/bans", response_model=BanOut, status_code=status.HTTP_201_CREATED)
async def create_ban(
    payload: BanCreateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> BanOut:
    """Ban an arbitrary email address or IP (works even for values with no
    registered account yet)."""
    ban_type = BanType(payload.ban_type)
    value = payload.value.strip()
    if ban_type is BanType.email:
        value = value.lower()
        # never let an admin ban their own email
        if value == admin.email.lower():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "لا يمكنك حظر نفسك / you can't ban yourself"
            )
        target = await db.scalar(select(User).where(User.email == value))
        if target is not None and target.role == UserRole.admin:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "لا يمكن حظر مشرف — أزل الإشراف أولاً / demote the admin first",
            )
    ban = await bans.add_ban(db, ban_type, value, payload.reason, admin.id)
    return BanOut.model_validate(ban)


@router.delete("/bans/{ban_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ban(
    ban_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    ban = await db.get(Ban, ban_id)
    if ban is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ban not found")
    await bans.remove_ban(db, ban)


# ---------------------------------------------------------------- submissions


@router.get("/submissions", response_model=list[SubmissionOut])
async def list_submissions(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[SubmissionOut]:
    stmt = select(Submission).order_by(Submission.created_at.desc())
    if status_filter:
        stmt = stmt.where(Submission.status == status_filter)
    rows = (await db.scalars(stmt)).all()
    return [SubmissionOut.model_validate(s) for s in rows]


@router.post("/submissions/{submission_id}/review", response_model=SubmissionOut)
async def review_submission(
    submission_id: int,
    payload: SubmissionReviewIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> SubmissionOut:
    submission = await db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if submission.status != SubmissionStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "Submission already reviewed")

    if payload.action == "approve":
        try:
            place_data = PlaceBase.model_validate(submission.place_json)
        except ValidationError as e:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Submission payload is not a valid place: {e.errors()[:3]}",
            )
        category_exists = await db.scalar(
            select(Category.id).where(Category.slug == place_data.category)
        )
        if category_exists is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Unknown category: {place_data.category}",
            )
        place = Place(
            **place_data.model_dump(), created_by=submission.user_id, approved=True
        )
        db.add(place)
        submission.status = SubmissionStatus.approved
        await award(db, submission.user_id, POINTS_SUGGESTION_APPROVED)  # bonus
        await db.flush()  # assign place.id before indexing
        approved_place = place
    else:
        approved_place = None
        if not payload.note:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "A rejection reason (note) is required"
            )
        submission.status = SubmissionStatus.rejected

    submission.review_note = payload.note
    submission.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(submission)
    if approved_place is not None:
        await index_place_metadata(db, approved_place)  # make the AI aware of it
    return SubmissionOut.model_validate(submission)


# ---------------------------------------------------------------- categories


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> list[CategoryOut]:
    rows = (await db.scalars(select(Category).order_by(Category.id))).all()
    return [CategoryOut.model_validate(c) for c in rows]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> CategoryOut:
    existing = await db.scalar(select(Category).where(Category.slug == payload.slug))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Category slug already exists")
    category = Category(**payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category)


@router.put("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    payload: CategoryIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> CategoryOut:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    slug_clash = await db.scalar(
        select(Category).where(Category.slug == payload.slug, Category.id != category_id)
    )
    if slug_clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "Category slug already exists")
    old_slug = category.slug
    for field, value in payload.model_dump().items():
        setattr(category, field, value)
    if old_slug != payload.slug:  # keep places pointing at the renamed slug
        await db.execute(
            Place.__table__.update().where(Place.category == old_slug).values(category=payload.slug)
        )
    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    in_use = await db.scalar(
        select(func.count(Place.id)).where(Place.category == category.slug)
    )
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"لا يمكن حذف التصنيف — {in_use} مكان يستخدمه / category in use by {in_use} place(s)",
        )
    await db.delete(category)
    await db.commit()


# ---------------------------------------------------------------- reports


@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> list[ReportOut]:
    rows = (
        await db.scalars(select(Report).order_by(Report.resolved, Report.created_at.desc()))
    ).all()
    return [ReportOut.model_validate(r) for r in rows]


@router.post("/reports/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ReportOut:
    report = await db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    report.resolved = True
    await db.commit()
    await db.refresh(report)
    return ReportOut.model_validate(report)


# ---------------------------------------------------------------- analytics


@router.get("/analytics", response_model=AnalyticsOut)
async def analytics(
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> AnalyticsOut:
    total_places = await db.scalar(select(func.count(Place.id))) or 0
    approved_places = (
        await db.scalar(select(func.count(Place.id)).where(Place.approved.is_(True))) or 0
    )
    total_users = await db.scalar(select(func.count(User.id))) or 0
    pending_submissions = (
        await db.scalar(
            select(func.count(Submission.id)).where(
                Submission.status == SubmissionStatus.pending
            )
        )
        or 0
    )
    indexed_places = await db.scalar(select(func.count(KnowledgeBase.id))) or 0
    total_chunks = await db.scalar(select(func.count(KnowledgeChunk.id))) or 0
    open_reports = (
        await db.scalar(select(func.count(Report.id)).where(Report.resolved.is_(False))) or 0
    )
    by_category_rows = (
        await db.execute(
            select(Place.category, func.count(Place.id))
            .where(Place.approved.is_(True))
            .group_by(Place.category)
        )
    ).all()

    return AnalyticsOut(
        total_places=total_places,
        approved_places=approved_places,
        total_users=total_users,
        pending_submissions=pending_submissions,
        indexed_places=indexed_places,
        total_chunks=total_chunks,
        open_reports=open_reports,
        places_by_category={category: count for category, count in by_category_rows},
    )
