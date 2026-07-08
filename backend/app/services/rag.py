"""RAG pipeline: query embedding → pgvector retrieval with metadata/geo
filters → context assembly → LLM → validated structured response.

Anti-hallucination guarantees enforced in code (not just the prompt):
- place ids returned by the LLM are intersected with the retrieved set;
- coordinates always come from the database, never from the LLM;
- with no LLM key configured, a deterministic answer is composed from
  the retrieved chunks only.
"""

import logging
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import KnowledgeChunk, Place
from app.schemas import AIPlaceRef, AIQueryIn, AIQueryOut
from app.services.embeddings import embedding_service, normalize_text
from app.services.geo import haversine_km, haversine_sql
from app.services.llm import llm_service

logger = logging.getLogger(__name__)
settings = get_settings()


# Proximity keywords: when present with a user location, results are ranked by
# real distance so "the nearest X" is answered from where the user actually is.
_NEAREST_TERMS = (
    "اقرب",
    "قريب",
    "قريبه",
    "حولي",
    "جنبي",
    "بقربي",
    "حواليي",
    "nearest",
    "near me",
    "nearby",
    "close to me",
    "closest",
    "around me",
)

# Outing/hangout planning: the user wants a whole plan (multiple stops + route),
# not a single place.
_PLANNING_TERMS = (
    "طلعه",
    "طلعة",
    "نطلع",
    "اطلع",
    "نخرج",
    "خرجه",
    "خرجة",
    "سهره",
    "سهرة",
    "نسهر",
    "برنامج",
    "خطه",
    "خطة",
    "رحله",
    "رحلة",
    "يوم كامل",
    "وين اروح",
    "وين نروح",
    "اماكن نروحها",
    "جدول",
    "مسار",
    "hangout",
    "hang out",
    "outing",
    "plan",
    "itinerary",
    "day out",
    "night out",
    "where to go",
    "spend the day",
    "trip",
    "route",
    "things to do",
)


# Strip emojis/pictographs so replies stay clean Arabic text (belt-and-braces
# on top of the system-prompt rule).
_EMOJI_RE = re.compile(
    "[\U0001f000-\U0001faff\U00002600-\U000027bf\U0001f1e6-\U0001f1ff"
    "\U00002b00-\U00002bff\U00002190-\U000021ff️‍✅❌]+"
)


def _no_emoji(text: str) -> str:
    return _EMOJI_RE.sub("", text).replace("  ", " ").strip()


@dataclass
class QueryIntent:
    """What the question is anchored to: a specific site, a named region,
    or the user's own coordinates."""

    site: Place | None = None
    region: str | None = None
    anchor: tuple[float, float] | None = None  # (lat, lng) for distance ranking
    wants_nearest: bool = False  # proximity query anchored on the user
    wants_plan: bool = False  # user wants a multi-stop outing/hangout plan


async def detect_intent(db: AsyncSession, payload: AIQueryIn) -> QueryIntent:
    """Match place names and regions mentioned in the query so answers are
    anchored to 'the site I asked about' or 'the area I said', not just
    the user's GPS position."""
    intent = QueryIntent()
    query_norm = normalize_text(payload.query)

    rows = (
        await db.execute(
            select(Place.id, Place.name_ar, Place.name_en, Place.lat, Place.lng, Place.region)
            .where(Place.approved.is_(True))
        )
    ).all()

    # Longest matching place name wins (avoids "وادي" matching every wadi).
    best_site_id, best_len = None, 0
    regions: set[str] = set()
    for pid, name_ar, name_en, lat, lng, region in rows:
        if region:
            regions.add(region)
        for name in (name_ar, name_en):
            name_norm = normalize_text(name)
            if len(name_norm) >= 4 and name_norm in query_norm and len(name_norm) > best_len:
                best_site_id, best_len = pid, len(name_norm)

    if best_site_id is not None:
        intent.site = await db.get(Place, best_site_id)
        if intent.site is not None and intent.site.lat is not None:
            intent.anchor = (intent.site.lat, intent.site.lng)

    if intent.site is None:
        best_region, best_region_len = None, 0
        for region in regions:
            region_norm = normalize_text(region)
            if len(region_norm) >= 3 and region_norm in query_norm and len(region_norm) > best_region_len:
                best_region, best_region_len = region, len(region_norm)
        intent.region = best_region

    # The user's own location anchors distances unless they asked about a site.
    has_user_location = payload.lat is not None and payload.lng is not None
    if intent.anchor is None and has_user_location:
        intent.anchor = (payload.lat, payload.lng)

    # Proximity intent: only meaningful when we know where the user is and they
    # didn't ask about a specific named site.
    if has_user_location and intent.site is None:
        intent.wants_nearest = any(term in query_norm for term in _NEAREST_TERMS)

    # Planning intent: the user wants a whole outing, not one place.
    intent.wants_plan = any(term in query_norm for term in _PLANNING_TERMS)
    return intent


@dataclass
class RetrievedPlace:
    place: Place
    distance_km: float | None
    chunks: list[KnowledgeChunk] = field(default_factory=list)
    best_score: float = 1.0  # cosine distance of best chunk (lower = better)


async def retrieve(
    db: AsyncSession, payload: AIQueryIn, intent: QueryIntent
) -> tuple[list[RetrievedPlace], list[int]]:
    """Vector search over knowledge chunks, filtered by place metadata/geo and
    the detected intent (specific site > named region > user location).
    Returns grouped places (ordered by best chunk score) and used chunk ids."""
    query_vector = await embedding_service.embed_text(payload.query)
    filters = payload.filters

    cosine_distance = KnowledgeChunk.embedding_vector.cosine_distance(query_vector)
    stmt = (
        select(KnowledgeChunk, Place, cosine_distance.label("score"))
        .join(Place, KnowledgeChunk.place_id == Place.id)
        .where(Place.approved.is_(True), KnowledgeChunk.embedding_vector.is_not(None))
    )
    if filters and filters.category:
        stmt = stmt.where(Place.category == filters.category)
    if filters and filters.tags:
        stmt = stmt.where(Place.tags.overlap(filters.tags))

    if intent.site is not None:
        # The user asked about a specific site → retrieve that site's knowledge
        # plus nearby context around it.
        radius = (filters.radius_km if filters else None) or settings.rag_default_radius_km
        anchor_lat, anchor_lng = intent.anchor or (None, None)
        if anchor_lat is not None:
            stmt = stmt.where(
                (KnowledgeChunk.place_id == intent.site.id)
                | (
                    Place.lat.is_not(None)
                    & (haversine_sql(anchor_lat, anchor_lng) <= radius)
                )
            )
        else:
            stmt = stmt.where(KnowledgeChunk.place_id == intent.site.id)
    elif intent.region is not None:
        stmt = stmt.where(Place.region == intent.region)
    elif intent.anchor is not None:
        # For an explicit "nearest" query, don't cap distance (the closest match
        # may lie beyond the default radius) unless the user set one; otherwise
        # keep results local to the default radius.
        explicit_radius = filters.radius_km if filters else None
        if intent.wants_nearest and explicit_radius is None:
            stmt = stmt.where(Place.lat.is_not(None))
        else:
            radius = explicit_radius or settings.rag_default_radius_km
            stmt = stmt.where(
                Place.lat.is_not(None),
                haversine_sql(intent.anchor[0], intent.anchor[1]) <= radius,
            )

    # Widen the candidate pool for proximity queries so the geo re-rank has
    # enough places to choose the genuinely closest relevant one.
    candidate_limit = settings.rag_top_k_chunks * (6 if intent.wants_nearest else 3)
    stmt = stmt.order_by(cosine_distance).limit(candidate_limit)
    rows = (await db.execute(stmt)).all()

    grouped: dict[int, RetrievedPlace] = {}
    used_chunk_ids: list[int] = []
    for chunk, place, score in rows:
        if len(used_chunk_ids) >= settings.rag_top_k_chunks and place.id not in grouped:
            continue
        entry = grouped.get(place.id)
        if entry is None:
            if len(grouped) >= settings.rag_max_places:
                continue
            distance = (
                haversine_km(intent.anchor[0], intent.anchor[1], place.lat, place.lng)
                if intent.anchor is not None and place.lat is not None
                else None
            )
            entry = RetrievedPlace(place=place, distance_km=distance, best_score=score)
            grouped[place.id] = entry
        if len(entry.chunks) < 4:
            entry.chunks.append(chunk)
            used_chunk_ids.append(chunk.id)

    if intent.wants_nearest:
        # Proximity query: closest relevant place first (places with no
        # coordinates sink to the bottom).
        ordered = sorted(
            grouped.values(),
            key=lambda r: (r.distance_km if r.distance_km is not None else 1e9, r.best_score),
        )
    else:
        # The asked-about site always leads the context, else best semantic match.
        ordered = sorted(
            grouped.values(),
            key=lambda r: (0 if intent.site and r.place.id == intent.site.id else 1, r.best_score),
        )
    return ordered, used_chunk_ids


def build_context(retrieved: list[RetrievedPlace]) -> str:
    blocks: list[str] = []
    for entry in retrieved:
        p = entry.place
        lines = [
            f"### place_id: {p.id}",
            f"الاسم: {p.name_ar} ({p.name_en})",
            f"التصنيف: {p.category}",
        ]
        if p.region:
            lines.append(f"المنطقة: {p.region}")
        if p.description:
            lines.append(f"الوصف: {p.description}")
        if entry.distance_km is not None:
            lines.append(f"المسافة من المستخدم: {entry.distance_km:.1f} كم")
        if p.tags:
            lines.append(f"وسوم: {', '.join(p.tags)}")
        if p.rating:
            lines.append(f"التقييم: {p.rating:.1f} ({p.rating_count})")
        for chunk in entry.chunks:
            if chunk.question:
                lines.append(f"س: {chunk.question}\nج: {chunk.answer}")
            else:
                lines.append(chunk.answer)
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _compose_offline_answer(query: str, retrieved: list[RetrievedPlace]) -> dict:
    """Deterministic fallback built strictly from retrieved context."""
    if not retrieved:
        return {"answer": "", "places": [], "map_highlight_ids": []}
    parts: list[str] = []
    places = []
    for entry in retrieved[:3]:
        p = entry.place
        best_qa = next((c for c in entry.chunks if c.question), None)
        reason = best_qa.answer if best_qa else (entry.chunks[0].answer if entry.chunks else "")
        if not reason:
            reason = p.description or p.name_ar
        reason = reason[:180]
        dist = f" (على بُعد حوالي {entry.distance_km:.1f} كم)" if entry.distance_km is not None else ""
        parts.append(f"• {p.name_ar}{dist}: {reason}")
        places.append(
            {
                "id": p.id,
                "name": p.name_ar,
                "reason": reason,
                "distance_km": round(entry.distance_km, 1) if entry.distance_km is not None else None,
            }
        )
    answer = "هاي أحلى أماكن لقيتها إلك:\n" + "\n".join(parts)
    return {
        "answer": answer,
        "places": places,
        "map_highlight_ids": [p["id"] for p in places],
    }


def _sanitize_llm_output(raw: dict, retrieved: list[RetrievedPlace]) -> AIQueryOut:
    """Enforce structural rules regardless of what the LLM produced."""
    by_id = {entry.place.id: entry for entry in retrieved}

    answer = str(raw.get("answer", "")).strip()
    out_places: list[AIPlaceRef] = []
    for item in raw.get("places", []) or []:
        if not isinstance(item, dict):
            continue
        try:
            pid = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        entry = by_id.get(pid)
        if entry is None:  # LLM invented a place — drop it
            continue
        out_places.append(
            AIPlaceRef(
                id=pid,
                name=entry.place.name_ar,
                reason=str(item.get("reason", ""))[:300],
                distance_km=round(entry.distance_km, 1) if entry.distance_km is not None else None,
                lat=entry.place.lat,  # coords strictly from DB
                lng=entry.place.lng,
                category=entry.place.category,
            )
        )

    highlight_ids = []
    for pid in raw.get("map_highlight_ids", []) or []:
        try:
            pid = int(pid)
        except (TypeError, ValueError):
            continue
        if pid in by_id and pid not in highlight_ids:
            highlight_ids.append(pid)
    if not highlight_ids:
        highlight_ids = [p.id for p in out_places]

    return AIQueryOut(answer=answer, places=out_places, map_highlight_ids=highlight_ids)


NO_RESULTS_ANSWER = (
    "ما لقيت أماكن تناسب سؤالك حالياً. "
    "جرّب توسّع دائرة البحث أو غيّر التصنيف."
)


async def nearest_places(
    db: AsyncSession, payload: AIQueryIn, intent: QueryIntent, exclude: set[int]
) -> list[RetrievedPlace]:
    """Nearest approved places by metadata alone (no knowledge file needed), so
    'what's the nearest X near me' works even before knowledge is uploaded."""
    if intent.anchor is None:
        return []
    lat, lng = intent.anchor
    stmt = select(Place).where(Place.approved.is_(True), Place.lat.is_not(None))
    if payload.filters and payload.filters.category:
        stmt = stmt.where(Place.category == payload.filters.category)
    stmt = stmt.order_by(haversine_sql(lat, lng)).limit(settings.rag_max_places)
    rows = (await db.scalars(stmt)).all()
    out: list[RetrievedPlace] = []
    for place in rows:
        if place.id in exclude:
            continue
        out.append(
            RetrievedPlace(
                place=place,
                distance_km=haversine_km(lat, lng, place.lat, place.lng),
                best_score=1.0,
            )
        )
    return out


async def planning_candidates(
    db: AsyncSession, payload: AIQueryIn, intent: QueryIntent
) -> list[RetrievedPlace]:
    """A diverse pool of real places to compose an outing from: nearest to the
    user when location is known, else top-rated. Caps per-category so the plan
    can mix a café, a viewpoint, food, etc."""
    stmt = select(Place).where(Place.approved.is_(True))
    if intent.region is not None:
        stmt = stmt.where(Place.region == intent.region)
    if payload.filters and payload.filters.category:
        stmt = stmt.where(Place.category == payload.filters.category)

    anchor = intent.anchor
    if anchor is not None:
        stmt = stmt.where(Place.lat.is_not(None)).order_by(
            haversine_sql(anchor[0], anchor[1])
        )
    else:
        stmt = stmt.order_by(Place.rating.desc(), Place.id)
    rows = (await db.scalars(stmt.limit(30))).all()

    per_category: dict[str, int] = {}
    out: list[RetrievedPlace] = []
    for place in rows:
        # keep variety: at most 3 of any one category in the candidate pool
        if per_category.get(place.category, 0) >= 3:
            continue
        per_category[place.category] = per_category.get(place.category, 0) + 1
        distance = (
            haversine_km(anchor[0], anchor[1], place.lat, place.lng)
            if anchor is not None and place.lat is not None
            else None
        )
        out.append(RetrievedPlace(place=place, distance_km=distance, best_score=0.0))
        if len(out) >= 12:
            break
    return out


def _build_route_url(
    origin: tuple[float, float] | None, stops: list[tuple[float | None, float | None]]
) -> str | None:
    """Google Maps directions URL chaining the itinerary stops (optionally from
    the user's location). Coordinates come from the DB, never the LLM."""
    points: list[str] = []
    if origin is not None:
        points.append(f"{origin[0]:.6f},{origin[1]:.6f}")
    for lat, lng in stops:
        if lat is not None and lng is not None:
            points.append(f"{lat:.6f},{lng:.6f}")
    if len(points) < 2:
        return None
    return "https://www.google.com/maps/dir/" + "/".join(points)


async def rag_query(db: AsyncSession, payload: AIQueryIn) -> AIQueryOut:
    intent = await detect_intent(db, payload)
    history = [t.model_dump() for t in payload.history]

    if intent.wants_plan:
        # Outing plan: use a diverse metadata pool (fast — no embedding call).
        retrieved = await planning_candidates(db, payload, intent)
        chunk_ids: list[int] = []
    else:
        retrieved, chunk_ids = await retrieve(db, payload, intent)
        # Asked about a specific site that has no knowledge file yet → still
        # answer from its metadata instead of "nothing found".
        if not retrieved and intent.site is not None:
            retrieved = [RetrievedPlace(place=intent.site, distance_km=None, best_score=0.0)]
        # Proximity query: ensure the genuinely nearest places appear even if
        # they have no knowledge file, and keep them ordered by distance.
        if intent.wants_nearest:
            extra = await nearest_places(db, payload, intent, {r.place.id for r in retrieved})
            retrieved = sorted(
                retrieved + extra,
                key=lambda r: (r.distance_km if r.distance_km is not None else 1e9, r.best_score),
            )[: settings.rag_max_places]

    if not retrieved:
        return AIQueryOut(answer=NO_RESULTS_ANSWER, places=[], map_highlight_ids=[], sources=[])

    context = build_context(retrieved)
    raw = await llm_service.answer(payload.query, context, history=history)
    used_llm = raw is not None and bool(raw.get("answer"))
    if not used_llm:
        raw = _compose_offline_answer(payload.query, retrieved)

    result = _sanitize_llm_output(raw, retrieved)
    result.answer = _no_emoji(result.answer)
    result.sources = chunk_ids
    result.is_plan = bool(raw.get("is_plan"))
    result.suggestions = [
        clean
        for s in (raw.get("suggestions") or [])
        if (clean := _no_emoji(str(s))[:80])
    ][:4]

    if intent.wants_plan:
        # Without an LLM, compose a simple ordered plan from the candidate pool.
        if not used_llm and len(result.places) >= 2:
            result.is_plan = True
        if result.is_plan and len(result.places) >= 2:
            origin = (
                (payload.lat, payload.lng)
                if payload.lat is not None and payload.lng is not None
                else None
            )
            result.route_url = _build_route_url(
                origin, [(p.lat, p.lng) for p in result.places]
            )
    elif not result.places:
        # Non-planning safety net: never return an answer with zero grounded places.
        fallback = _compose_offline_answer(payload.query, retrieved)
        result.places = _sanitize_llm_output(fallback, retrieved).places
        result.map_highlight_ids = [p.id for p in result.places]
    return result
