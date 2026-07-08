from httpx import AsyncClient

from .conftest import SAMPLE_PLACE

# 1x1 transparent PNG
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000d4944415478da63fcffffff030007000280"
    "cddfaf340000000049454e44ae426082"
)


async def create_place(admin_client: AsyncClient) -> dict:
    resp = await admin_client.post("/places", json=SAMPLE_PLACE)
    assert resp.status_code == 201
    return resp.json()


async def test_upload_and_delete_image(admin_client: AsyncClient):
    place = await create_place(admin_client)

    files = [("files", ("photo.png", PNG_BYTES, "image/png"))]
    resp = await admin_client.post(f"/places/{place['id']}/images", files=files)
    assert resp.status_code == 201, resp.text
    images = resp.json()["images"]
    assert len(images) == 1
    assert images[0].startswith("/media/places/")

    # visible on public detail
    detail = (await admin_client.get(f"/places/{place['id']}")).json()
    assert detail["images"] == images

    # delete
    resp = await admin_client.delete(
        f"/places/{place['id']}/images", params={"url": images[0]}
    )
    assert resp.status_code == 200
    assert resp.json()["images"] == []


async def test_upload_rejects_bad_type(admin_client: AsyncClient):
    place = await create_place(admin_client)
    files = [("files", ("evil.exe", b"MZ....", "application/octet-stream"))]
    resp = await admin_client.post(f"/places/{place['id']}/images", files=files)
    assert resp.status_code == 422


async def test_upload_requires_admin(client: AsyncClient, user_token: str):
    files = [("files", ("photo.png", PNG_BYTES, "image/png"))]
    resp = await client.post(
        "/places/1/images",
        files=files,
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 403
