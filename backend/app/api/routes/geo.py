"""Resolve a Google Maps URL (including short links) to coordinates."""

import re
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas import GeoResolveOut, GeoSearchResult

router = APIRouter(tags=["geo"])

# Keyless OpenStreetMap geocoder tuned for type-ahead. Biased toward Jordan.
_PHOTON_URL = "https://photon.komoot.io/api/"
_PHOTON_LANGS = {"en", "de", "fr"}  # Photon only supports these; else local names
_JORDAN_CENTER = (31.95, 35.93)
_GEO_HEADERS = {"User-Agent": "makan/1.0 (+https://nasamat.me)"}

# Only these hosts are fetched server-side (prevents SSRF via arbitrary URLs).
_ALLOWED_HOSTS = {
    "google.com",
    "www.google.com",
    "maps.google.com",
    "maps.app.goo.gl",
    "goo.gl",
    "g.co",
}

# Ordered by precision: place pin (!3d!4d) > @center > q/ll params.
_PATTERNS = [
    re.compile(r"!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)"),
    re.compile(r"@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)"),
    re.compile(r"[?&](?:q|query|ll|center|destination|daddr)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)"),
]


def extract_coords(text: str) -> tuple[float, float] | None:
    text = unquote(text)
    for pat in _PATTERNS:
        m = pat.search(text)
        if m:
            lat, lng = float(m.group(1)), float(m.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng
    return None


def _host_allowed(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == h or host.endswith("." + h) for h in _ALLOWED_HOSTS)


@router.get("/geo/resolve", response_model=GeoResolveOut)
async def resolve_google_maps(url: str = Query(min_length=8, max_length=2048)) -> GeoResolveOut:
    """Extract coordinates from a Google Maps link. Tries the URL directly;
    for short links (maps.app.goo.gl / goo.gl) it follows the redirect."""
    if not url.startswith(("http://", "https://")) or not _host_allowed(url):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "رابط جوجل مابس غير صالح / not a Google Maps link")

    coords = extract_coords(url)
    if coords is None:
        # short link → follow the redirect chain and re-scan the final URL
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            coords = extract_coords(str(resp.url)) or extract_coords(resp.text[:20000])
        except httpx.HTTPError:
            coords = None

    if coords is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "تعذر استخراج الموقع من الرابط / couldn't read coordinates from that link",
        )
    return GeoResolveOut(lat=coords[0], lng=coords[1])


def _format_photon(feature: dict) -> GeoSearchResult | None:
    props = feature.get("properties") or {}
    coords = (feature.get("geometry") or {}).get("coordinates")
    if not coords or len(coords) < 2:
        return None
    name = props.get("name") or props.get("street") or props.get("city") or props.get("state")
    if not name:
        return None
    parts: list[str] = []
    if props.get("street") and props.get("housenumber"):
        parts.append(f"{props['street']} {props['housenumber']}")
    elif props.get("street") and props["street"] != name:
        parts.append(props["street"])
    for key in ("city", "state", "country"):
        value = props.get(key)
        if value and value != name and value not in parts:
            parts.append(value)
    try:
        return GeoSearchResult(
            name=str(name), label=", ".join(parts), lat=float(coords[1]), lng=float(coords[0])
        )
    except (TypeError, ValueError):
        return None


@router.get("/geo/search", response_model=list[GeoSearchResult])
async def geo_search(
    q: str = Query(min_length=2, max_length=120),
    lat: float | None = None,
    lng: float | None = None,
    lang: str = "default",
) -> list[GeoSearchResult]:
    """Search real-world places by name (streets, towns, POIs) via a keyless
    OSM geocoder, biased toward the user's location or Jordan. Used to place a
    pin precisely and to find nearby things by name on the map."""
    bias_lat, bias_lng = (lat, lng) if lat is not None and lng is not None else _JORDAN_CENTER
    params = {"q": q, "limit": 6, "lat": bias_lat, "lon": bias_lng}
    if lang in _PHOTON_LANGS:
        params["lang"] = lang
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(_PHOTON_URL, params=params, headers=_GEO_HEADERS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError):
        return []  # geocoder unavailable → empty results, never an error

    results: list[GeoSearchResult] = []
    for feature in (data.get("features") or [])[:6]:
        formatted = _format_photon(feature)
        if formatted is not None:
            results.append(formatted)
    return results
