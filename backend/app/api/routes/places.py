from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional, require_admin
from app.db.session import get_db
from app.models import Category, Favorite, KnowledgeBase, Place, Review, User, UserRole
from app.schemas import (
    PageOut,
    PlaceCreate,
    PlaceDetailOut,
    PlaceOut,
    PlaceUpdate,
    QAPair,
    ReviewCreate,
    ReviewOut,
    ReviewsPage,
)
from app.services.geo import haversine_sql
from app.services.knowledge import index_place_metadata
from app.services.media import MediaError, delete_place_image_file, save_place_image
from app.services.points import POINTS_REVIEW, award

router = APIRouter(prefix="/places", tags=["places"])


async def ensure_category_exists(db: AsyncSession, slug: str) -> None:
    """Categories are admin-managed rows, so slugs are validated against the DB."""
    exists = await db.scalar(select(Category.id).where(Category.slug == slug))
    if exists is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown category: {slug}"
        )


async def recompute_rating(db: AsyncSession, place: Place) -> None:
    row = (
        await db.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(
                Review.place_id == place.id
            )
        )
    ).one()
    average, count = row
    place.rating = round(float(average), 2) if average is not None else 0.0
    place.rating_count = count


@router.get("", response_model=PageOut)
async def list_places(
    q: str | None = Query(default=None, max_length=200),
    category: str | None = None,
    tags: str | None = Query(default=None, description="comma-separated"),
    region: str | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=500),
    bbox: str | None = Query(default=None, description="minLng,minLat,maxLng,maxLat"),
    include_unapproved: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> PageOut:
    stmt = select(Place)

    is_admin = user is not None and user.role == UserRole.admin
    if not (include_unapproved and is_admin):
        stmt = stmt.where(Place.approved.is_(True))

    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Place.name_ar.ilike(pattern),
                Place.name_en.ilike(pattern),
                Place.description.ilike(pattern),
            )
        )
    if category:
        stmt = stmt.where(Place.category == category)
    if region:
        stmt = stmt.where(Place.region == region)
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            stmt = stmt.where(Place.tags.overlap(tag_list))
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = (float(v) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid bbox format")
        stmt = stmt.where(
            Place.lat.between(min_lat, max_lat), Place.lng.between(min_lng, max_lng)
        )

    if lat is not None and lng is not None:
        distance = haversine_sql(lat, lng)
        stmt = stmt.where(Place.lat.is_not(None))
        if radius_km is not None:
            stmt = stmt.where(distance <= radius_km)
        stmt = stmt.order_by(distance)
    else:
        stmt = stmt.order_by(Place.rating.desc(), Place.id)

    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    ).all()

    return PageOut(
        items=[PlaceOut.model_validate(p) for p in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{place_id}", response_model=PlaceDetailOut)
async def get_place(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> PlaceDetailOut:
    place = await db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    is_admin = user is not None and user.role == UserRole.admin
    if not place.approved and not is_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")

    detail = PlaceDetailOut.model_validate(place)

    kb = await db.scalar(select(KnowledgeBase).where(KnowledgeBase.place_id == place_id))
    if kb and isinstance(kb.raw_json, dict):
        detail.qa = [
            QAPair(q=item["q"], a=item["a"])
            for item in kb.raw_json.get("qa", [])
            if isinstance(item, dict) and item.get("q") and item.get("a")
        ]

    if user is not None:
        fav = await db.get(Favorite, (user.id, place_id))
        detail.is_favorite = fav is not None
    return detail


@router.post("", response_model=PlaceOut, status_code=status.HTTP_201_CREATED)
async def create_place(
    payload: PlaceCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> PlaceOut:
    await ensure_category_exists(db, payload.category)
    place = Place(**payload.model_dump(), created_by=admin.id)
    db.add(place)
    await db.commit()
    await db.refresh(place)
    await index_place_metadata(db, place)  # make the AI aware of it immediately
    return PlaceOut.model_validate(place)


@router.put("/{place_id}", response_model=PlaceOut)
async def update_place(
    place_id: int,
    payload: PlaceUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> PlaceOut:
    place = await db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    if payload.category is not None:
        await ensure_category_exists(db, payload.category)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(place, field, value)
    await db.commit()
    await db.refresh(place)
    await index_place_metadata(db, place)  # refresh the AI's view of it
    return PlaceOut.model_validate(place)


@router.delete("/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_place(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    place = await db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    await db.delete(place)
    await db.commit()


# ---------------------------------------------------------------- reviews


@router.get("/{place_id}/reviews", response_model=ReviewsPage)
async def list_reviews(
    place_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> ReviewsPage:
    place = await db.get(Place, place_id)
    if place is None or not place.approved:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")

    rows = (
        await db.execute(
            select(Review, User.name)
            .join(User, Review.user_id == User.id)
            .where(Review.place_id == place_id)
            .order_by(Review.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).all()
    total = (
        await db.scalar(select(func.count(Review.id)).where(Review.place_id == place_id))
    ) or 0

    return ReviewsPage(
        items=[
            ReviewOut(
                id=review.id,
                user_id=review.user_id,
                user_name=name,
                rating=review.rating,
                comment=review.comment,
                created_at=review.created_at,
                is_mine=user is not None and review.user_id == user.id,
            )
            for review, name in rows
        ],
        total=total,
        average=place.rating,
    )


@router.post("/{place_id}/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def upsert_review(
    place_id: int,
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReviewOut:
    """One review per user per place — posting again updates your review."""
    place = await db.get(Place, place_id)
    if place is None or not place.approved:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")

    review = await db.scalar(
        select(Review).where(Review.user_id == user.id, Review.place_id == place_id)
    )
    is_new = review is None
    if is_new:
        review = Review(user_id=user.id, place_id=place_id, rating=payload.rating)
        db.add(review)
    review.rating = payload.rating
    review.comment = (payload.comment or "").strip() or None
    await db.flush()
    await recompute_rating(db, place)
    if is_new:  # points only for a first review on a place (not edits)
        await award(db, user.id, POINTS_REVIEW)
    await db.commit()
    await db.refresh(review)

    return ReviewOut(
        id=review.id,
        user_id=user.id,
        user_name=user.name,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        is_mine=True,
    )


@router.delete("/{place_id}/reviews/mine", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_review(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    review = await db.scalar(
        select(Review).where(Review.user_id == user.id, Review.place_id == place_id)
    )
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have no review on this place")
    await db.delete(review)
    await db.flush()
    place = await db.get(Place, place_id)
    if place is not None:
        await recompute_rating(db, place)
    await db.commit()


# ---------------------------------------------------------------- images


@router.post("/{place_id}/images", response_model=PlaceOut, status_code=status.HTTP_201_CREATED)
async def upload_place_images(
    place_id: int,
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> PlaceOut:
    """Upload one or more photos for a place (admin). Stored locally under
    /media (or Cloudinary when configured); URLs appended to place.images."""
    place = await db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    if len(files) > 12:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "12 صورة كحد أقصى بالطلب الواحد")

    urls: list[str] = []
    for file in files:
        try:
            urls.append(await save_place_image(place_id, file))
        except MediaError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    place.images = [*(place.images or []), *urls]
    await db.commit()
    await db.refresh(place)
    return PlaceOut.model_validate(place)


@router.delete("/{place_id}/images", response_model=PlaceOut)
async def delete_place_image(
    place_id: int,
    url: str = Query(min_length=1),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> PlaceOut:
    place = await db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    if url not in (place.images or []):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found on this place")
    place.images = [u for u in place.images if u != url]
    delete_place_image_file(url)
    await db.commit()
    await db.refresh(place)
    return PlaceOut.model_validate(place)


# ---------------------------------------------------------------- favorites


@router.post("/{place_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    place = await db.get(Place, place_id)
    if place is None or not place.approved:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    if await db.get(Favorite, (user.id, place_id)) is None:
        db.add(Favorite(user_id=user.id, place_id=place_id))
        await db.commit()


@router.delete("/{place_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    fav = await db.get(Favorite, (user.id, place_id))
    if fav is not None:
        await db.delete(fav)
        await db.commit()
