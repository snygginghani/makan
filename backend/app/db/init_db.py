import logging

from sqlalchemy import text

from app.db.session import engine
from app.models import Base

logger = logging.getLogger(__name__)

# HNSW gives good recall/latency for our scale without tuning lists like ivfflat.
VECTOR_INDEX_DDL = """
CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_embedding_hnsw
ON knowledge_chunks USING hnsw (embedding_vector vector_cosine_ops)
"""


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(VECTOR_INDEX_DDL))
        # lightweight in-place migrations for columns added after first release
        await conn.execute(
            text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(20)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(64)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS picture VARCHAR(500)")
        )
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified "
                "BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_code VARCHAR(12)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMPTZ")
        )
        # existing password/google accounts are considered verified
        await conn.execute(
            text(
                "UPDATE users SET email_verified = TRUE "
                "WHERE email_verified = FALSE AND "
                "(google_sub IS NOT NULL OR hashed_password IS NOT NULL)"
            )
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS home_region VARCHAR(80)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(300)")
        )
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded "
                "BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0")
        )
        # Moderation (bans)
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned "
                "BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45)")
        )
        # Last shared location (map GPS)
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS location_at TIMESTAMPTZ")
        )
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username "
                "ON users (username)"
            )
        )
        # accounts that existed before onboarding shipped keep working
        await conn.execute(
            text("UPDATE users SET onboarded = TRUE WHERE onboarded = FALSE")
        )
        await conn.execute(
            text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL")
        )
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub "
                "ON users (google_sub)"
            )
        )
    logger.info("Database initialized (tables + pgvector extension + HNSW index)")
