"""Knowledge-base ingestion: parse admin JSON → chunk QA → embed → store in pgvector."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import KnowledgeBase, KnowledgeChunk, Place
from app.schemas import KnowledgeFile
from app.services.embeddings import embedding_service

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_KNOWLEDGE_FILE_BYTES = 2 * 1024 * 1024  # 2 MB


class KnowledgeValidationError(Exception):
    pass


def parse_knowledge_json(raw_bytes: bytes) -> KnowledgeFile:
    """Validate an uploaded knowledge file. Raises KnowledgeValidationError."""
    if len(raw_bytes) > MAX_KNOWLEDGE_FILE_BYTES:
        raise KnowledgeValidationError("File exceeds 2 MB limit")
    try:
        # utf-8-sig tolerates the BOM that Windows editors often prepend
        data = json.loads(raw_bytes.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise KnowledgeValidationError(f"Invalid JSON: {e}")
    if not isinstance(data, dict):
        raise KnowledgeValidationError("Knowledge file must be a JSON object")
    try:
        return KnowledgeFile.model_validate(data)
    except ValidationError as e:
        raise KnowledgeValidationError(f"Schema validation failed: {e.errors()[:5]}")


def build_chunks(kf: KnowledgeFile, place: Place) -> list[dict]:
    """Split knowledge into retrieval units. Each QA pair is one chunk;
    description and tags each become one supplementary chunk."""
    chunks: list[dict] = [
        {"question": qa.q, "answer": qa.a, "source": "qa"} for qa in kf.qa
    ]
    if place.description:
        chunks.append(
            {"question": None, "answer": place.description, "source": "description"}
        )
    tags = list(dict.fromkeys([*(kf.tags or []), *(place.tags or [])]))
    if tags:
        chunks.append({"question": None, "answer": " ، ".join(tags), "source": "tags"})
    return chunks


def chunk_embed_text(chunk: dict, place: Place) -> str:
    """Text used for the chunk embedding — prefixed with place identity and
    category so retrieval can match place names and categories, not just QA."""
    header = f"{place.name_ar} | {place.name_en} | {place.category}"
    if chunk["question"]:
        return f"{header}\nس: {chunk['question']}\nج: {chunk['answer']}"
    return f"{header}\n{chunk['answer']}"


def _mean_vector(vectors: list[list[float]]) -> list[float] | None:
    if not vectors:
        return None
    dim = len(vectors[0])
    mean = [sum(v[i] for v in vectors) / len(vectors) for i in range(dim)]
    return mean


def save_raw_file(place_id: int, raw_bytes: bytes) -> str:
    directory = Path(settings.knowledge_dir)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"place_{place_id}.json"
    path.write_bytes(raw_bytes)
    return str(path)


async def index_knowledge(
    db: AsyncSession, place: Place, kf: KnowledgeFile, raw_bytes: bytes | None = None
) -> KnowledgeBase:
    """Idempotent (re)index: replaces existing chunks and KB row content."""
    chunks = build_chunks(kf, place)
    texts = [chunk_embed_text(c, place) for c in chunks]
    vectors = await embedding_service.embed_texts(texts)

    kb = await db.scalar(select(KnowledgeBase).where(KnowledgeBase.place_id == place.id))
    raw_json = kf.model_dump(mode="json")
    if kb is None:
        kb = KnowledgeBase(place_id=place.id, raw_json=raw_json)
        db.add(kb)
    else:
        kb.raw_json = raw_json

    if raw_bytes is not None:
        kb.file_path = save_raw_file(place.id, raw_bytes)

    kb.embedding_vector = _mean_vector(vectors)
    kb.chunk_count = len(chunks)
    kb.indexed_at = datetime.now(timezone.utc)
    await db.flush()

    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.place_id == place.id))
    for chunk, vector in zip(chunks, vectors):
        db.add(
            KnowledgeChunk(
                place_id=place.id,
                kb_id=kb.id,
                question=chunk["question"],
                answer=chunk["answer"],
                source=chunk["source"],
                embedding_vector=vector,
            )
        )
    await db.commit()
    await db.refresh(kb)
    logger.info("Indexed place %s: %d chunks", place.id, len(chunks))
    return kb


def _place_metadata_text(place: Place) -> str:
    """Compact, retrieval-friendly description of a place built from its fields."""
    parts = [f"{place.name_ar} | {place.name_en}", f"التصنيف: {place.category}"]
    if place.region:
        parts.append(f"المنطقة: {place.region}")
    if place.description:
        parts.append(place.description)
    if place.tags:
        parts.append("وسوم: " + " ، ".join(place.tags))
    return "\n".join(parts)


async def index_place_metadata(db: AsyncSession, place: Place) -> None:
    """Ensure the AI is aware of a place even without an uploaded knowledge file.

    Embeds the place's own fields (name/category/region/description/tags) as a
    single 'meta' chunk. Skips places that already have an uploaded knowledge
    base (their chunks already cover the metadata). Best-effort: never blocks
    place creation if embedding is unavailable.
    """
    has_kb = await db.scalar(
        select(KnowledgeBase.id).where(KnowledgeBase.place_id == place.id)
    )
    if has_kb is not None:
        return
    try:
        vectors = await embedding_service.embed_texts([_place_metadata_text(place)])
    except Exception:
        logger.warning("Metadata embedding failed for place %s; skipping", place.id)
        return
    await db.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.place_id == place.id, KnowledgeChunk.source == "meta"
        )
    )
    db.add(
        KnowledgeChunk(
            place_id=place.id,
            kb_id=None,
            question=None,
            answer=_place_metadata_text(place),
            source="meta",
            embedding_vector=vectors[0] if vectors else None,
        )
    )
    await db.commit()
    logger.info("Indexed metadata for place %s", place.id)


async def reindex_place(db: AsyncSession, place: Place) -> KnowledgeBase:
    """Re-embed from the stored raw_json (e.g. after switching embedding models)."""
    kb = await db.scalar(select(KnowledgeBase).where(KnowledgeBase.place_id == place.id))
    if kb is None:
        raise KnowledgeValidationError("No knowledge file uploaded for this place")
    kf = KnowledgeFile.model_validate(kb.raw_json)
    return await index_knowledge(db, place, kf)
