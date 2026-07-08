"""Send verification-code emails. Uses SMTP when configured, otherwise logs
the code (dev mode) so sign-up can be tested without an email server."""

import logging
import secrets
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def generate_code() -> str:
    """A 6-digit numeric code (zero-padded)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _build_message(to_email: str, code: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = f"رمز التحقق في مكان: {code}"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(
        f"مرحباً،\n\nرمز التحقق الخاص بك في مكان هو: {code}\n"
        f"ينتهي خلال {settings.verify_code_ttl_minutes} دقيقة.\n\n"
        f"Your Makan verification code is: {code}\n"
        f"It expires in {settings.verify_code_ttl_minutes} minutes.\n"
    )
    return msg


def send_verification_email(to_email: str, code: str) -> bool:
    """Returns True if the email was actually sent via SMTP, False if it was
    only logged (dev mode / SMTP not configured)."""
    if not settings.smtp_configured:
        logger.warning("SMTP not configured — verification code for %s is %s", to_email, code)
        return False
    try:
        msg = _build_message(to_email, code)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_starttls:
                server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info("Verification email sent to %s", to_email)
        return True
    except Exception:
        logger.exception("Failed to send verification email to %s", to_email)
        return False
