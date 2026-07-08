"""Verify Google Sign-In ID tokens (from Google Identity Services)."""

from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import get_settings

settings = get_settings()

# One shared transport for verification requests.
_transport = google_requests.Request()


class GoogleAuthError(Exception):
    pass


@dataclass
class GoogleProfile:
    sub: str
    email: str
    name: str
    picture: str | None


def verify_google_credential(credential: str) -> GoogleProfile:
    """Validate the ID token against our client id and return the profile.
    Raises GoogleAuthError on any problem."""
    if not settings.google_client_id:
        raise GoogleAuthError("Google Sign-In is not configured on the server")
    try:
        claims = id_token.verify_oauth2_token(
            credential, _transport, settings.google_client_id
        )
    except ValueError as e:
        raise GoogleAuthError(f"Invalid Google token: {e}")

    if not claims.get("email_verified", False):
        raise GoogleAuthError("Google account email is not verified")

    email = claims.get("email")
    sub = claims.get("sub")
    if not email or not sub:
        raise GoogleAuthError("Google token missing email or subject")

    return GoogleProfile(
        sub=str(sub),
        email=str(email).lower(),
        name=str(claims.get("name") or email.split("@")[0]),
        picture=claims.get("picture"),
    )
