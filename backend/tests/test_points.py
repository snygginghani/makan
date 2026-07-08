from httpx import AsyncClient

from .conftest import SAMPLE_PLACE


async def create_place(admin_client: AsyncClient, **overrides) -> dict:
    resp = await admin_client.post("/places", json={**SAMPLE_PLACE, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_onboarding_sets_username(admin_client: AsyncClient):
    me = (await admin_client.get("/me")).json()
    assert me["onboarded"] is False

    resp = await admin_client.patch(
        "/me", json={"username": "explorer", "home_region": "عمان", "bio": "أحب المطلات"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "explorer"
    assert body["onboarded"] is True


async def test_username_uniqueness(admin_client: AsyncClient, user_token: str):
    await admin_client.patch("/me", json={"username": "taken"})
    resp = await admin_client.patch(
        "/me", json={"username": "taken"}, headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 409


async def test_points_awarded_for_review(admin_client: AsyncClient, user_token: str):
    place = await create_place(admin_client)
    headers = {"Authorization": f"Bearer {user_token}"}

    await admin_client.post(
        f"/places/{place['id']}/reviews", json={"rating": 5, "comment": "رائع"}, headers=headers
    )
    stats = (await admin_client.get("/me/stats", headers=headers)).json()
    assert stats["points"] == 10
    assert stats["reviews_count"] == 1

    # editing the same review doesn't add points again
    await admin_client.post(
        f"/places/{place['id']}/reviews", json={"rating": 4}, headers=headers
    )
    stats = (await admin_client.get("/me/stats", headers=headers)).json()
    assert stats["points"] == 10


async def test_points_for_suggestion_and_approval(admin_client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}
    suggestion = {**SAMPLE_PLACE, "images": ["/media/suggestions/2/x.png"]}
    sub = await admin_client.post(
        "/submissions", json={"place_json": suggestion}, headers=headers
    )
    assert sub.status_code == 201

    stats = (await admin_client.get("/me/stats", headers=headers)).json()
    assert stats["points"] == 10  # submission
    assert stats["submissions_count"] == 1

    # admin approves → +40 bonus
    approve = await admin_client.post(
        f"/admin/submissions/{sub.json()['id']}/review",
        json={"action": "approve", "note": "شكراً"},
    )
    assert approve.status_code == 200
    stats = (await admin_client.get("/me/stats", headers=headers)).json()
    assert stats["points"] == 50
    assert stats["approved_count"] == 1


async def test_leaderboard_ranks_by_points(admin_client: AsyncClient, user_token: str):
    place = await create_place(admin_client)
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # user reviews (10 pts); admin reviews (10 pts) — tie broken by id
    await admin_client.post(
        f"/places/{place['id']}/reviews", json={"rating": 5}, headers=user_headers
    )
    board = (await admin_client.get("/leaderboard")).json()
    assert len(board) == 1
    assert board[0]["rank"] == 1
    assert board[0]["points"] == 10

    stats = (await admin_client.get("/me/stats", headers=user_headers)).json()
    assert stats["rank"] == 1
    assert stats["total_contributors"] == 1
