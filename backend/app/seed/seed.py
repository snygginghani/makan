"""Seed the database: admin user, categories, 150 Jordan places, and sample
knowledge files indexed through the real embedding pipeline.

Run from backend/:  python -m app.seed.seed
Idempotent — safe to run repeatedly.
"""

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select

from app.core.security import hash_password
from app.db.init_db import init_db
from app.db.session import async_session_factory
from app.models import Category, Place, User, UserRole
from app.schemas import KnowledgeFile
from app.seed.places_data import clean_places
from app.services.knowledge import index_knowledge

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

ADMIN_EMAIL = "admin@makan.jo"
ADMIN_PASSWORD = "admin123456"  # change in production

# (slug, name_ar, name_en, icon, color) — colors are distinct so map pins,
# chips and cards are visually separable at a glance.
CATEGORIES = [
    ("viewpoint", "مطلات", "Viewpoints", "mountain-snow", "#E2725B"),
    ("mountain", "جبال", "Mountains", "mountain", "#A78BFA"),
    ("valley", "أودية", "Valleys", "waves", "#38BDF8"),
    ("waterfall", "شلالات وينابيع", "Waterfalls & Springs", "droplets", "#22D3EE"),
    ("photo_spot", "أماكن تصوير", "Photo Spots", "camera", "#F472B6"),
    ("hiking_trail", "مسارات مشي", "Hiking Trails", "footprints", "#4ADE80"),
    ("camping", "مخيمات", "Camping", "tent", "#FB923C"),
    ("cafe", "كافيهات", "Cafés", "coffee", "#FBBF24"),
    ("restaurant", "مطاعم", "Restaurants", "utensils", "#F87171"),
    ("study_spot", "أماكن دراسة", "Study Spots", "book-open", "#818CF8"),
    ("hidden_gem", "أماكن مخفية", "Hidden Gems", "gem", "#E879F9"),
]

KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"


async def seed(with_places: bool = True) -> None:
    await init_db()
    async with async_session_factory() as db:
        # --- admin ---
        admin = await db.scalar(select(User).where(User.email == ADMIN_EMAIL))
        if admin is None:
            admin = User(
                name="Makan Admin",
                email=ADMIN_EMAIL,
                hashed_password=hash_password(ADMIN_PASSWORD),
                role=UserRole.admin,
                email_verified=True,
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
            logger.info("Created admin user %s", ADMIN_EMAIL)

        # --- categories (upsert colors so existing rows get backfilled too) ---
        for slug, name_ar, name_en, icon, color in CATEGORIES:
            existing = await db.scalar(select(Category).where(Category.slug == slug))
            if existing is None:
                db.add(
                    Category(
                        slug=slug, name_ar=name_ar, name_en=name_en, icon=icon, color=color
                    )
                )
            elif existing.color is None:
                existing.color = color
        await db.commit()

        if not with_places:
            logger.info("Seeded admin + categories only (no demo places)")
            return

        # --- places ---
        created = 0
        for data in clean_places():
            existing = await db.scalar(select(Place).where(Place.name_en == data["name_en"]))
            if existing is None:
                db.add(Place(**data, created_by=admin.id))
                created += 1
        await db.commit()
        logger.info("Places: %d newly created", created)

        # --- knowledge files (indexed through the real pipeline) ---
        indexed = 0
        for path in sorted(KNOWLEDGE_DIR.glob("*.json")):
            raw = path.read_bytes()
            data = json.loads(raw.decode("utf-8"))
            kf = KnowledgeFile.model_validate(data)
            place = await db.scalar(select(Place).where(Place.name_ar == data["name"]))
            if place is None:
                logger.warning("No place matches knowledge file %s (name=%s)", path.name, data["name"])
                continue
            await index_knowledge(db, place, kf, raw_bytes=raw)
            indexed += 1
        logger.info("Knowledge files indexed: %d", indexed)


if __name__ == "__main__":
    import sys

    asyncio.run(seed(with_places="--categories-only" not in sys.argv))
