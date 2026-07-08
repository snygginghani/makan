from httpx import AsyncClient

from .conftest import SAMPLE_PLACE


async def create_place(admin_client: AsyncClient, **overrides) -> dict:
    resp = await admin_client.post("/places", json={**SAMPLE_PLACE, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------- reviews


async def test_review_upsert_and_aggregate(admin_client: AsyncClient, user_token: str):
    place = await create_place(admin_client)
    headers = {"Authorization": f"Bearer {user_token}"}

    resp = await admin_client.post(
        f"/places/{place['id']}/reviews",
        json={"rating": 4, "comment": "مكان جميل جداً"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["is_mine"] is True

    # admin (another user) reviews too
    resp = await admin_client.post(
        f"/places/{place['id']}/reviews", json={"rating": 2, "comment": "Too crowded"}
    )
    assert resp.status_code == 201

    detail = (await admin_client.get(f"/places/{place['id']}")).json()
    assert detail["rating"] == 3.0
    assert detail["rating_count"] == 2

    # same user posts again → update, not duplicate
    resp = await admin_client.post(
        f"/places/{place['id']}/reviews", json={"rating": 5}, headers=headers
    )
    assert resp.status_code == 201
    page = (await admin_client.get(f"/places/{place['id']}/reviews")).json()
    assert page["total"] == 2
    assert page["average"] == 3.5

    # delete own review
    resp = await admin_client.delete(f"/places/{place['id']}/reviews/mine", headers=headers)
    assert resp.status_code == 204
    detail = (await admin_client.get(f"/places/{place['id']}")).json()
    assert detail["rating_count"] == 1
    assert detail["rating"] == 2.0


async def test_review_requires_auth(admin_client: AsyncClient):
    place = await create_place(admin_client)
    resp = await admin_client.post(
        f"/places/{place['id']}/reviews",
        json={"rating": 5},
        headers={"Authorization": ""},
    )
    assert resp.status_code == 401

    resp = await admin_client.post(f"/places/{place['id']}/reviews", json={"rating": 9})
    assert resp.status_code == 422


# ---------------------------------------------------------------- categories


async def test_public_categories(client: AsyncClient):
    resp = await client.get("/categories")
    assert resp.status_code == 200
    slugs = [c["slug"] for c in resp.json()]
    assert "viewpoint" in slugs


async def test_admin_category_crud_and_validation(admin_client: AsyncClient):
    # unknown category rejected on place create
    resp = await admin_client.post("/places", json={**SAMPLE_PLACE, "category": "nonsense"})
    assert resp.status_code == 422

    # admin adds it → creation works
    resp = await admin_client.post(
        "/admin/categories",
        json={"slug": "nonsense", "name_ar": "تجريبي", "name_en": "Nonsense", "color": "#123456"},
    )
    assert resp.status_code == 201
    category_id = resp.json()["id"]

    place = await create_place(admin_client, category="nonsense")

    # cannot delete a category in use
    resp = await admin_client.delete(f"/admin/categories/{category_id}")
    assert resp.status_code == 409

    # rename slug → places follow
    resp = await admin_client.put(
        f"/admin/categories/{category_id}",
        json={"slug": "renamed", "name_ar": "معاد", "name_en": "Renamed", "color": "#654321"},
    )
    assert resp.status_code == 200
    updated = (await admin_client.get(f"/places/{place['id']}")).json()
    assert updated["category"] == "renamed"

    # delete after removing the place
    await admin_client.delete(f"/places/{place['id']}")
    resp = await admin_client.delete(f"/admin/categories/{category_id}")
    assert resp.status_code == 204


# ---------------------------------------------------------------- suggestion photos


async def test_submission_requires_photo(admin_client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = await admin_client.post(
        "/submissions", json={"place_json": SAMPLE_PLACE}, headers=headers
    )
    assert resp.status_code == 422  # no images

    with_photo = {**SAMPLE_PLACE, "images": ["/media/suggestions/2/x.png"]}
    resp = await admin_client.post(
        "/submissions", json={"place_json": with_photo}, headers=headers
    )
    assert resp.status_code == 201


async def test_suggestion_image_upload(admin_client: AsyncClient, user_token: str):
    from .test_images import PNG_BYTES

    headers = {"Authorization": f"Bearer {user_token}"}
    files = [("files", ("photo.png", PNG_BYTES, "image/png"))]
    resp = await admin_client.post("/uploads/images", files=files, headers=headers)
    assert resp.status_code == 201, resp.text
    urls = resp.json()
    assert len(urls) == 1 and urls[0].startswith("/media/suggestions/")
