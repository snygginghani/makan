import os
import sys
import tempfile
from pathlib import Path

# Must configure env BEFORE importing app modules (settings are cached).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://makan:makan@localhost:5433/makan_test"
)
os.environ["EMBEDDING_PROVIDER"] = "local"
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["AI_RATE_LIMIT"] = "10000/minute"
os.environ["KNOWLEDGE_DIR"] = tempfile.mkdtemp(prefix="makan_knowledge_")
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="makan_media_")
os.environ["JWT_SECRET"] = "test-secret"

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db.init_db import init_db  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402

TEST_DB = "makan_test"


@pytest.fixture(scope="session", autouse=True)
async def prepare_database():
    conn = await asyncpg.connect(
        user="makan", password="makan", host="localhost", port=5433, database="makan"
    )
    try:
        await conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    except asyncpg.DuplicateDatabaseError:
        pass
    finally:
        await conn.close()
    await init_db()
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables(prepare_database):
    from app.services import bans

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, places, knowledge_base, knowledge_chunks, "
                "favorites, submissions, reports, reviews, categories, bans "
                "RESTART IDENTITY CASCADE"
            )
        )
        # Place.category is validated against this table
        await conn.execute(
            text(
                "INSERT INTO categories (slug, name_ar, name_en, icon, color) VALUES "
                "('viewpoint','مطلات','Viewpoints','mountain-snow','#E2725B'),"
                "('cafe','كافيهات','Cafés','coffee','#FBBF24'),"
                "('hiking_trail','مسارات','Trails','footprints','#4ADE80')"
            )
        )
    bans.invalidate()  # drop the in-process ban cache between tests
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def register_and_verify(client: AsyncClient, name: str, email: str) -> str:
    """Full email-signup flow → returns the access token. SMTP is unconfigured
    in tests, so the code comes back in the register response (dev_code)."""
    resp = await client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
        headers={"Authorization": ""},
    )
    assert resp.status_code == 201, resp.text
    code = resp.json()["dev_code"]
    assert code, "expected dev_code when SMTP is not configured"
    verify = await client.post(
        "/auth/verify", json={"email": email, "code": code}, headers={"Authorization": ""}
    )
    assert verify.status_code == 200, verify.text
    return verify.json()["access_token"]


@pytest.fixture
async def admin_client(client: AsyncClient):
    """First registered user becomes admin (bootstrap rule)."""
    token = await register_and_verify(client, "Admin", "admin@test.jo")
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture
async def user_token(admin_client: AsyncClient):
    """A regular (second) user; returns their token. admin_client keeps admin auth."""
    return await register_and_verify(admin_client, "User", "user@test.jo")


SAMPLE_PLACE = {
    "name_ar": "مطل الاختبار",
    "name_en": "Test Viewpoint",
    "description": "مطل جميل للاختبار على وادي الأردن",
    "lat": 32.333,
    "lng": 35.751,
    "category": "viewpoint",
    "tags": ["غروب", "تصوير"],
    "region": "عجلون",
}

SAMPLE_KNOWLEDGE = {
    "name": "مطل الاختبار",
    "category": "viewpoint",
    "qa": [
        {"q": "هل المكان مناسب للعائلات؟", "a": "نعم مناسب جداً ويوجد جلسات آمنة."},
        {"q": "أفضل وقت للزيارة؟", "a": "وقت الغروب هو الأفضل لمشاهدة الشمس تغيب خلف الجبال."},
        {"q": "هل يوجد مواقف سيارات؟", "a": "يوجد موقف واسع مجاني قرب المدخل."},
    ],
    "tags": ["غروب", "تصوير", "جبال"],
}
