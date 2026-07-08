from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db.session import get_db
from app.models import KnowledgeBase, Place, User
from app.schemas import KnowledgeOut
from app.services.knowledge import (
    KnowledgeValidationError,
    index_knowledge,
    parse_knowledge_json,
    reindex_place,
)

router = APIRouter(prefix="/admin/knowledge", tags=["admin:knowledge"])


@router.post("/upload-json", response_model=KnowledgeOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_json(
    file: UploadFile,
    place_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> KnowledgeOut:
    """Upload a QA knowledge JSON for a place. `place_id` can come from the
    query param or the `place_id` field inside the file. The file is validated,
    chunked, embedded and stored in pgvector; the raw JSON is kept on disk."""
    if file.content_type not in ("application/json", "text/json", "application/octet-stream", None):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Expected a JSON file")
    raw = await file.read()
    try:
        kf = parse_knowledge_json(raw)
    except KnowledgeValidationError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    target_id = place_id
    if target_id is None and kf.place_id is not None:
        try:
            target_id = int(kf.place_id)
        except (TypeError, ValueError):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "place_id in file is not a valid integer"
            )
    if target_id is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Provide place_id as query param or inside the JSON file",
        )

    place = await db.get(Place, target_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Place {target_id} not found")

    kb = await index_knowledge(db, place, kf, raw_bytes=raw)
    return KnowledgeOut(place_id=place.id, chunk_count=kb.chunk_count, indexed_at=kb.indexed_at)


@router.post("/reindex/{place_id}", response_model=KnowledgeOut)
async def reindex_knowledge(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> KnowledgeOut:
    """Re-embed a place from its stored raw JSON (e.g. after an embedding model change)."""
    place = await db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    try:
        kb = await reindex_place(db, place)
    except KnowledgeValidationError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    return KnowledgeOut(
        place_id=place.id,
        chunk_count=kb.chunk_count,
        indexed_at=kb.indexed_at,
        status="reindexed",
    )


@router.get("/{place_id}")
async def get_knowledge(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    kb = await db.scalar(select(KnowledgeBase).where(KnowledgeBase.place_id == place_id))
    if kb is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No knowledge file for this place")
    return {
        "place_id": place_id,
        "raw_json": kb.raw_json,
        "chunk_count": kb.chunk_count,
        "indexed_at": kb.indexed_at,
    }
