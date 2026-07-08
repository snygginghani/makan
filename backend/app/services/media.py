"""Place photo storage: local disk under MEDIA_DIR (served at /media) by
default, Cloudinary when CLOUDINARY_URL is configured."""

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings

settings = get_settings()

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB


class MediaError(Exception):
    pass


def _use_cloudinary() -> bool:
    return bool(settings.cloudinary_url)


async def save_image(folder: str, file: UploadFile) -> str:
    """Validate and persist one image under the given folder; returns its
    public URL (relative /media/... for local storage, absolute for Cloudinary)."""
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if ext is None:
        raise MediaError(f"نوع الملف غير مدعوم ({file.content_type}) — JPG/PNG/WebP/GIF فقط")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise MediaError("حجم الصورة يتجاوز 8MB")
    if len(data) == 0:
        raise MediaError("ملف فارغ")

    if _use_cloudinary():
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(cloudinary_url=settings.cloudinary_url)
        result = cloudinary.uploader.upload(
            data, folder=f"makan/{folder}", resource_type="image"
        )
        return result["secure_url"]

    directory = Path(settings.media_dir) / folder
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (directory / name).write_bytes(data)
    return f"/media/{folder}/{name}"


async def save_place_image(place_id: int, file: UploadFile) -> str:
    return await save_image(f"places/{place_id}", file)


def delete_place_image_file(url: str) -> None:
    """Best-effort removal of the underlying local file (no-op for remote URLs)."""
    if not url.startswith("/media/"):
        return
    relative = url.removeprefix("/media/")
    path = (Path(settings.media_dir) / relative).resolve()
    media_root = Path(settings.media_dir).resolve()
    if media_root in path.parents and path.is_file():
        path.unlink(missing_ok=True)
