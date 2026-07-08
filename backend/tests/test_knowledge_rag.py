import json

from httpx import AsyncClient

from .conftest import SAMPLE_KNOWLEDGE, SAMPLE_PLACE


async def create_place(admin_client: AsyncClient, **overrides) -> dict:
    resp = await admin_client.post("/places", json={**SAMPLE_PLACE, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def upload_knowledge(admin_client: AsyncClient, place_id: int, knowledge: dict) -> dict:
    files = {"file": ("knowledge.json", json.dumps(knowledge, ensure_ascii=False), "application/json")}
    resp = await admin_client.post(
        f"/admin/knowledge/upload-json?place_id={place_id}", files=files
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_upload_knowledge_creates_chunks(admin_client: AsyncClient):
    place = await create_place(admin_client)
    result = await upload_knowledge(admin_client, place["id"], SAMPLE_KNOWLEDGE)
    # 3 QA + description + tags = 5 chunks
    assert result["chunk_count"] == 5
    assert result["indexed_at"] is not None

    stored = (await admin_client.get(f"/admin/knowledge/{place['id']}")).json()
    assert len(stored["raw_json"]["qa"]) == 3

    # QA visible on the public place page
    detail = (await admin_client.get(f"/places/{place['id']}")).json()
    assert len(detail["qa"]) == 3


async def test_upload_invalid_json_rejected(admin_client: AsyncClient):
    place = await create_place(admin_client)
    files = {"file": ("bad.json", "{not valid json", "application/json")}
    resp = await admin_client.post(
        f"/admin/knowledge/upload-json?place_id={place['id']}", files=files
    )
    assert resp.status_code == 422

    files = {"file": ("empty.json", json.dumps({"qa": []}), "application/json")}
    resp = await admin_client.post(
        f"/admin/knowledge/upload-json?place_id={place['id']}", files=files
    )
    assert resp.status_code == 422


async def test_upload_requires_admin(client: AsyncClient, user_token: str):
    files = {"file": ("k.json", json.dumps(SAMPLE_KNOWLEDGE), "application/json")}
    resp = await client.post(
        "/admin/knowledge/upload-json?place_id=1",
        files=files,
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 403


async def test_reindex(admin_client: AsyncClient):
    place = await create_place(admin_client)
    await upload_knowledge(admin_client, place["id"], SAMPLE_KNOWLEDGE)
    resp = await admin_client.post(f"/admin/knowledge/reindex/{place['id']}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "reindexed"
    assert resp.json()["chunk_count"] == 5

    # reindex without knowledge → 404
    other = await create_place(admin_client, name_en="No KB", name_ar="بدون معرفة")
    resp = await admin_client.post(f"/admin/knowledge/reindex/{other['id']}")
    assert resp.status_code == 404


async def test_ai_query_returns_grounded_answer(admin_client: AsyncClient):
    place = await create_place(admin_client)
    await upload_knowledge(admin_client, place["id"], SAMPLE_KNOWLEDGE)

    resp = await admin_client.post(
        "/ai/query",
        json={"query": "مطل قريب مني للغروب", "lat": 32.30, "lng": 35.75},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["answer"]
    assert body["places"], "expected grounded place suggestions"
    assert body["places"][0]["id"] == place["id"]
    assert body["places"][0]["distance_km"] is not None
    assert body["map_highlight_ids"] == [place["id"]]
    # coords come from DB
    assert body["places"][0]["lat"] == place["lat"]


async def test_ai_query_radius_filter_excludes_far_places(admin_client: AsyncClient):
    place = await create_place(admin_client)  # Ajloun ~32.33,35.75
    await upload_knowledge(admin_client, place["id"], SAMPLE_KNOWLEDGE)

    # user is in Aqaba, 300km away, radius 20km → nothing
    resp = await admin_client.post(
        "/ai/query",
        json={
            "query": "مطل للغروب",
            "lat": 29.5,
            "lng": 35.0,
            "filters": {"radius_km": 20},
        },
    )
    body = resp.json()
    assert body["places"] == []
    assert body["map_highlight_ids"] == []


async def test_ai_query_category_filter(admin_client: AsyncClient):
    place = await create_place(admin_client)
    await upload_knowledge(admin_client, place["id"], SAMPLE_KNOWLEDGE)

    resp = await admin_client.post(
        "/ai/query",
        json={"query": "أفضل وقت للزيارة؟", "filters": {"category": "cafe"}},
    )
    assert resp.json()["places"] == []

    resp = await admin_client.post(
        "/ai/query",
        json={"query": "أفضل وقت للزيارة؟", "filters": {"category": "viewpoint"}},
    )
    assert resp.json()["places"] != []


async def test_ai_query_nearest_ranks_by_distance(admin_client: AsyncClient):
    # two viewpoints with knowledge, one near the user, one far
    near = await create_place(
        admin_client, name_en="Near VP", name_ar="مطل قريب", lat=31.96, lng=35.92
    )
    far = await create_place(
        admin_client, name_en="Far VP", name_ar="مطل بعيد", lat=32.55, lng=35.85
    )
    await upload_knowledge(admin_client, near["id"], {**SAMPLE_KNOWLEDGE, "name": "مطل قريب"})
    await upload_knowledge(admin_client, far["id"], {**SAMPLE_KNOWLEDGE, "name": "مطل بعيد"})

    # user in Amman → nearest viewpoint should lead the answer
    resp = await admin_client.post(
        "/ai/query",
        json={"query": "أقرب مطل قريب مني للغروب", "lat": 31.95, "lng": 35.91},
    )
    body = resp.json()
    assert body["places"], "expected nearby results"
    assert body["places"][0]["id"] == near["id"]
    assert body["places"][0]["distance_km"] < 10


async def test_ai_query_no_knowledge(admin_client: AsyncClient):
    resp = await admin_client.post("/ai/query", json={"query": "وين أروح؟"})
    assert resp.status_code == 200
    assert resp.json()["places"] == []
    assert resp.json()["answer"]  # graceful "no results" message


async def test_place_auto_indexed_for_ai(admin_client: AsyncClient):
    # Creating a place WITHOUT uploading any knowledge JSON should still make it
    # known to the AI (a metadata chunk is embedded automatically).
    place = await create_place(admin_client)
    stats = (await admin_client.get("/admin/analytics")).json()
    assert stats["total_chunks"] >= 1  # the auto metadata chunk

    # and it can be surfaced by a proximity query with no knowledge file
    resp = await admin_client.post(
        "/ai/query", json={"query": "مطل قريب مني", "lat": 32.33, "lng": 35.75}
    )
    body = resp.json()
    assert any(p["id"] == place["id"] for p in body["places"])


async def test_ai_hangout_plan_builds_route(admin_client: AsyncClient):
    # a mix of categories near Amman
    await create_place(
        admin_client, name_en="Cafe A", name_ar="كافيه أ", category="cafe", lat=31.95, lng=35.92
    )
    await create_place(
        admin_client, name_en="View B", name_ar="مطل ب", category="viewpoint", lat=31.97, lng=35.90
    )
    await create_place(
        admin_client,
        name_en="Trail C",
        name_ar="مسار ج",
        category="hiking_trail",
        lat=31.96,
        lng=35.93,
    )

    resp = await admin_client.post(
        "/ai/query",
        json={"query": "بدي طلعة حلوة اليوم", "lat": 31.95, "lng": 35.91},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["is_plan"] is True
    assert len(body["places"]) >= 2
    assert body["route_url"]
    assert body["route_url"].startswith("https://www.google.com/maps/dir/")
    # user origin + at least two stops → at least 3 "lat,lng" points
    assert body["route_url"].count(",") >= 3


async def test_analytics(admin_client: AsyncClient):
    place = await create_place(admin_client)
    await upload_knowledge(admin_client, place["id"], SAMPLE_KNOWLEDGE)
    stats = (await admin_client.get("/admin/analytics")).json()
    assert stats["total_places"] == 1
    assert stats["indexed_places"] == 1
    assert stats["total_chunks"] == 5
    assert stats["places_by_category"]["viewpoint"] == 1
