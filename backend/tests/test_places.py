from httpx import AsyncClient

from .conftest import SAMPLE_PLACE


async def create_place(admin_client: AsyncClient, **overrides) -> dict:
    payload = {**SAMPLE_PLACE, **overrides}
    resp = await admin_client.post("/places", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_requires_admin(client: AsyncClient, user_token: str):
    resp = await client.post(
        "/places", json=SAMPLE_PLACE, headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 403


async def test_crud_roundtrip(admin_client: AsyncClient):
    place = await create_place(admin_client)
    pid = place["id"]
    assert place["coords_verified"] is False

    got = await admin_client.get(f"/places/{pid}")
    assert got.status_code == 200
    assert got.json()["name_ar"] == "مطل الاختبار"

    upd = await admin_client.put(f"/places/{pid}", json={"rating": 4.5, "name_en": "Updated"})
    assert upd.status_code == 200
    assert upd.json()["name_en"] == "Updated"

    assert (await admin_client.delete(f"/places/{pid}")).status_code == 204
    assert (await admin_client.get(f"/places/{pid}")).status_code == 404


async def test_invalid_category_rejected(admin_client: AsyncClient):
    resp = await admin_client.post("/places", json={**SAMPLE_PLACE, "category": "nonsense"})
    assert resp.status_code == 422


async def test_list_filters(admin_client: AsyncClient):
    await create_place(admin_client)  # viewpoint in Ajloun 32.333,35.751
    await create_place(
        admin_client,
        name_en="Amman Cafe",
        name_ar="كافيه عمان",
        category="cafe",
        lat=31.95,
        lng=35.93,
        region="عمان",
        tags=["قهوة"],
    )

    all_resp = (await admin_client.get("/places")).json()
    assert all_resp["total"] == 2

    cafes = (await admin_client.get("/places", params={"category": "cafe"})).json()
    assert cafes["total"] == 1
    assert cafes["items"][0]["category"] == "cafe"

    near = (
        await admin_client.get(
            "/places", params={"lat": 31.95, "lng": 35.93, "radius_km": 20}
        )
    ).json()
    assert near["total"] == 1
    assert near["items"][0]["name_en"] == "Amman Cafe"

    tagged = (await admin_client.get("/places", params={"tags": "غروب"})).json()
    assert tagged["total"] == 1

    search = (await admin_client.get("/places", params={"q": "عمان"})).json()
    assert search["total"] == 1


async def test_unapproved_hidden_from_public(admin_client: AsyncClient, client: AsyncClient):
    place = await create_place(admin_client, approved=False, name_en="Draft Place")
    public = await client.get("/places", headers={"Authorization": ""})
    assert public.json()["total"] == 0
    resp = await client.get(f"/places/{place['id']}", headers={"Authorization": ""})
    assert resp.status_code == 404
    # admin can see it with include_unapproved
    admin_list = (await admin_client.get("/places", params={"include_unapproved": True})).json()
    assert admin_list["total"] == 1


async def test_favorites_flow(admin_client: AsyncClient, user_token: str):
    place = await create_place(admin_client)
    headers = {"Authorization": f"Bearer {user_token}"}

    assert (
        await admin_client.post(f"/places/{place['id']}/favorite", headers=headers)
    ).status_code == 204
    favs = (await admin_client.get("/me/favorites", headers=headers)).json()
    assert len(favs) == 1

    detail = (await admin_client.get(f"/places/{place['id']}", headers=headers)).json()
    assert detail["is_favorite"] is True

    assert (
        await admin_client.delete(f"/places/{place['id']}/favorite", headers=headers)
    ).status_code == 204
    assert (await admin_client.get("/me/favorites", headers=headers)).json() == []


async def test_submission_review_flow(admin_client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}
    suggestion = {**SAMPLE_PLACE, "images": ["/media/suggestions/2/photo.png"]}
    sub = await admin_client.post(
        "/submissions", json={"place_json": suggestion}, headers=headers
    )
    assert sub.status_code == 201
    sub_id = sub.json()["id"]

    pending = (await admin_client.get("/admin/submissions", params={"status_filter": "pending"})).json()
    assert len(pending) == 1

    # rejection requires a note
    resp = await admin_client.post(
        f"/admin/submissions/{sub_id}/review", json={"action": "reject"}
    )
    assert resp.status_code == 422

    approved = await admin_client.post(
        f"/admin/submissions/{sub_id}/review", json={"action": "approve", "note": "جميل"}
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    places = (await admin_client.get("/places")).json()
    assert places["total"] == 1

    # cannot re-review
    again = await admin_client.post(
        f"/admin/submissions/{sub_id}/review", json={"action": "approve"}
    )
    assert again.status_code == 409


async def test_report_flow(admin_client: AsyncClient, user_token: str):
    place = await create_place(admin_client)
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = await admin_client.post(
        "/reports", json={"place_id": place["id"], "reason": "معلومات غير دقيقة"}, headers=headers
    )
    assert resp.status_code == 201
    reports = (await admin_client.get("/admin/reports")).json()
    assert len(reports) == 1
    resolved = await admin_client.post(f"/admin/reports/{reports[0]['id']}/resolve")
    assert resolved.json()["resolved"] is True
