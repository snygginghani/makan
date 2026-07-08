import math

from sqlalchemy import Float, cast, func
from sqlalchemy.sql.elements import ColumnElement

from app.models import Place

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


def haversine_sql(lat: float, lng: float) -> ColumnElement[float]:
    """SQL expression computing distance in km from (lat, lng) to Place.lat/lng."""
    lat_r = math.radians(lat)
    place_lat_r = func.radians(Place.lat)
    place_lng_r = func.radians(Place.lng)
    a = (
        func.pow(func.sin((place_lat_r - lat_r) / 2), 2)
        + math.cos(lat_r)
        * func.cos(place_lat_r)
        * func.pow(func.sin((place_lng_r - math.radians(lng)) / 2), 2)
    )
    # least() guards asin domain errors from float rounding
    return cast(
        EARTH_RADIUS_KM * 2 * func.asin(func.sqrt(func.least(a, 1.0))),
        Float,
    )
