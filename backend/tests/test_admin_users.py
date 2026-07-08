from httpx import AsyncClient

from app.api.routes import geo as geo_route


async def test_list_users_admin_only(admin_client: AsyncClient, user_token: str):
    # admin can list all users (admin + the regular user = 2)
    resp = await admin_client.get("/admin/users")
    assert resp.status_code == 200
    users = resp.json()
    assert len(users) >= 2
    assert {"email", "role", "points", "home_region"} <= users[0].keys()

    # regular user is forbidden
    resp = await admin_client.get(
        "/admin/users", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 403


async def test_promote_and_demote(admin_client: AsyncClient, user_token: str):
    users = (await admin_client.get("/admin/users")).json()
    regular = next(u for u in users if u["role"] == "user")

    promoted = await admin_client.patch(
        f"/admin/users/{regular['id']}/role", json={"role": "admin"}
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"

    # now that user can hit an admin route
    resp = await admin_client.get(
        "/admin/users", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200

    demoted = await admin_client.patch(
        f"/admin/users/{regular['id']}/role", json={"role": "user"}
    )
    assert demoted.json()["role"] == "user"


async def test_cannot_change_own_role(admin_client: AsyncClient):
    me = (await admin_client.get("/me")).json()
    resp = await admin_client.patch(f"/admin/users/{me['id']}/role", json={"role": "user"})
    assert resp.status_code == 400


async def test_ban_and_unban_user(admin_client: AsyncClient, user_token: str):
    users = (await admin_client.get("/admin/users")).json()
    regular = next(u for u in users if u["role"] == "user")

    # the user's token works before the ban
    ok = await admin_client.get("/me", headers={"Authorization": f"Bearer {user_token}"})
    assert ok.status_code == 200

    banned = await admin_client.post(f"/admin/users/{regular['id']}/ban", json={})
    assert banned.status_code == 200, banned.text
    assert banned.json()["banned"] is True

    # the existing token is now rejected
    blocked = await admin_client.get(
        "/me", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert blocked.status_code == 403

    # the ban shows up in the ban list
    bans = (await admin_client.get("/admin/bans")).json()
    assert any(b["ban_type"] == "email" and b["value"] == "user@test.jo" for b in bans)

    # unbanning restores access
    lifted = await admin_client.post(f"/admin/users/{regular['id']}/unban")
    assert lifted.status_code == 200
    assert lifted.json()["banned"] is False
    restored = await admin_client.get(
        "/me", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert restored.status_code == 200


async def test_cannot_ban_self(admin_client: AsyncClient):
    me = (await admin_client.get("/me")).json()
    resp = await admin_client.post(f"/admin/users/{me['id']}/ban", json={})
    assert resp.status_code == 400


async def test_cannot_ban_admin(admin_client: AsyncClient, user_token: str):
    users = (await admin_client.get("/admin/users")).json()
    regular = next(u for u in users if u["role"] == "user")
    await admin_client.patch(f"/admin/users/{regular['id']}/role", json={"role": "admin"})
    resp = await admin_client.post(f"/admin/users/{regular['id']}/ban", json={})
    assert resp.status_code == 400


async def test_banned_email_cannot_get_token(admin_client: AsyncClient, client: AsyncClient):
    resp = await admin_client.post(
        "/admin/bans", json={"ban_type": "email", "value": "banned@test.jo"}
    )
    assert resp.status_code == 201, resp.text

    # register succeeds but the ban blocks issuing a token at verify time
    reg = await client.post(
        "/auth/register",
        json={"name": "Bad", "email": "banned@test.jo", "password": "password123"},
        headers={"Authorization": ""},
    )
    assert reg.status_code == 201
    code = reg.json()["dev_code"]
    verify = await client.post(
        "/auth/verify",
        json={"email": "banned@test.jo", "code": code},
        headers={"Authorization": ""},
    )
    assert verify.status_code == 403


async def test_user_location_visible_to_admin(admin_client: AsyncClient, user_token: str):
    # user shares their location
    resp = await admin_client.post(
        "/me/location",
        json={"lat": 31.9539, "lng": 35.9106},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 204

    # admin sees it on the user row
    users = (await admin_client.get("/admin/users")).json()
    regular = next(u for u in users if u["role"] == "user")
    assert abs(regular["last_lat"] - 31.9539) < 1e-6
    assert abs(regular["last_lng"] - 35.9106) < 1e-6
    assert regular["location_at"] is not None


async def test_location_rejects_out_of_range(admin_client: AsyncClient):
    resp = await admin_client.post("/me/location", json={"lat": 200, "lng": 0})
    assert resp.status_code == 422


async def test_geo_resolve_direct_url(admin_client: AsyncClient):
    resp = await admin_client.get(
        "/geo/resolve", params={"url": "https://www.google.com/maps/place/X/@32.01,35.89,15z"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert abs(body["lat"] - 32.01) < 0.001 and abs(body["lng"] - 35.89) < 0.001


async def test_geo_search_returns_places(admin_client: AsyncClient, monkeypatch):
    payload = {
        "features": [
            {
                "geometry": {"coordinates": [35.93146, 31.94946]},
                "properties": {"name": "Rainbow Street", "city": "Amman", "country": "Jordan"},
            },
            {
                "geometry": {"coordinates": [35.88968, 32.27845]},
                "properties": {"name": "جرش", "state": "محافظة جرش", "country": "الأردن"},
            },
        ]
    }

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return payload

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return _Resp()

    monkeypatch.setattr(geo_route.httpx, "AsyncClient", _Client)
    resp = await admin_client.get("/geo/search", params={"q": "Rainbow Street"})
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 2
    assert results[0]["name"] == "Rainbow Street"
    assert abs(results[0]["lat"] - 31.94946) < 1e-6
    assert abs(results[0]["lng"] - 35.93146) < 1e-6
    assert "Amman" in results[0]["label"]


async def test_geo_search_handles_geocoder_down(admin_client: AsyncClient, monkeypatch):
    import httpx as _httpx

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            raise _httpx.ConnectError("boom")

    monkeypatch.setattr(geo_route.httpx, "AsyncClient", _Client)
    resp = await admin_client.get("/geo/search", params={"q": "anything"})
    assert resp.status_code == 200
    assert resp.json() == []


async def test_geo_resolve_rejects_non_google(admin_client: AsyncClient):
    resp = await admin_client.get("/geo/resolve", params={"url": "https://evil.example.com/x"})
    assert resp.status_code == 422


async def test_geo_resolve_short_link(admin_client: AsyncClient, monkeypatch):
    class _Resp:
        url = "https://www.google.com/maps/place/Petra/@30.3285,35.4444,17z"
        text = ""

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return _Resp()

    monkeypatch.setattr(geo_route.httpx, "AsyncClient", _Client)
    resp = await admin_client.get(
        "/geo/resolve", params={"url": "https://maps.app.goo.gl/abcd1234"}
    )
    assert resp.status_code == 200
    assert abs(resp.json()["lat"] - 30.3285) < 0.001
