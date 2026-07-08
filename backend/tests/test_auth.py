from httpx import AsyncClient

from app.api.routes import auth as auth_route
from app.services.google_auth import GoogleProfile

from .conftest import register_and_verify


async def test_google_login_creates_and_links_user(client: AsyncClient, monkeypatch):
    profile = GoogleProfile(
        sub="google-sub-123",
        email="visitor@gmail.com",
        name="Google Visitor",
        picture="https://example.com/pic.jpg",
    )
    monkeypatch.setattr(auth_route, "verify_google_credential", lambda cred: profile)

    resp = await client.post("/auth/google", json={"credential": "fake-id-token"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["email"] == "visitor@gmail.com"
    assert body["user"]["picture"] == "https://example.com/pic.jpg"
    assert body["access_token"]

    # signing in again with the same google sub returns the same user (no dup)
    me = await client.get(
        "/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.json()["email"] == "visitor@gmail.com"

    resp2 = await client.post("/auth/google", json={"credential": "fake-id-token"})
    assert resp2.json()["user"]["id"] == body["user"]["id"]


async def test_google_login_admin_via_allowlist(client: AsyncClient, monkeypatch):
    from app.core.config import get_settings

    get_settings().admin_emails = "boss@makan.jo"
    try:
        profile = GoogleProfile(
            sub="sub-admin", email="boss@makan.jo", name="Boss", picture=None
        )
        monkeypatch.setattr(auth_route, "verify_google_credential", lambda cred: profile)
        resp = await client.post("/auth/google", json={"credential": "fake-id-token"})
        assert resp.json()["user"]["role"] == "admin"
    finally:
        get_settings().admin_emails = ""


async def test_register_returns_code_and_requires_verification(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={"name": "First", "email": "first@test.jo", "password": "password123"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["verification_required"] is True
    assert body["dev_code"]  # SMTP not configured in tests

    # cannot log in before verifying
    login = await client.post(
        "/auth/login", json={"email": "first@test.jo", "password": "password123"}
    )
    assert login.status_code == 403

    # verify → logged in, first user is admin
    verify = await client.post(
        "/auth/verify", json={"email": "first@test.jo", "code": body["dev_code"]}
    )
    assert verify.status_code == 200
    assert verify.json()["user"]["role"] == "admin"


async def test_verify_wrong_code_rejected(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"name": "Bad", "email": "bad@test.jo", "password": "password123"},
    )
    resp = await client.post("/auth/verify", json={"email": "bad@test.jo", "code": "000000"})
    assert resp.status_code == 400


async def test_register_duplicate_verified_email(client: AsyncClient):
    await register_and_verify(client, "Dup", "dup@test.jo")
    resp = await client.post(
        "/auth/register",
        json={"name": "Dup", "email": "dup@test.jo", "password": "password123"},
        headers={"Authorization": ""},
    )
    assert resp.status_code == 409


async def test_login_and_me(client: AsyncClient):
    token = await register_and_verify(client, "Login", "login@test.jo")
    resp = await client.post(
        "/auth/login", json={"email": "login@test.jo", "password": "password123"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    me = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "login@test.jo"


async def test_login_wrong_password(client: AsyncClient):
    await register_and_verify(client, "Wrong", "wrong@test.jo")
    resp = await client.post(
        "/auth/login", json={"email": "wrong@test.jo", "password": "bad-password"}
    )
    assert resp.status_code == 401


async def test_protected_route_requires_token(client: AsyncClient):
    assert (await client.get("/me")).status_code == 401
    resp = await client.get("/me", headers={"Authorization": "Bearer invalid.token"})
    assert resp.status_code == 401


async def test_admin_route_forbidden_for_user(client: AsyncClient, user_token: str):
    resp = await client.get(
        "/admin/analytics", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 403
