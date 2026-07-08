from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.net import client_ip
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import User, UserRole
from app.services import bans
from app.schemas import (
    GoogleAuthIn,
    LoginIn,
    RegisterIn,
    RegisterOut,
    ResendIn,
    TokenOut,
    UserOut,
    VerifyIn,
)
from app.services.email import generate_code, send_verification_email
from app.services.google_auth import GoogleAuthError, verify_google_credential

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


async def _resolve_role(db: AsyncSession, email: str) -> UserRole:
    """Admin if the email is allow-listed, or if this is the very first user."""
    if email.lower() in settings.admin_email_set:
        return UserRole.admin
    user_count = await db.scalar(select(func.count(User.id)))
    return UserRole.admin if user_count == 0 else UserRole.user


async def _reject_if_banned(db: AsyncSession, request: Request, email: str) -> None:
    """Block sign-in when either the email or the request IP is banned."""
    if await bans.is_email_banned(db, email) or await bans.is_ip_banned(
        db, client_ip(request)
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "تم حظر هذا الحساب / This account has been banned"
        )


def _issue_verification(user: User) -> str:
    code = generate_code()
    user.verify_code = code
    user.verify_expires = datetime.now(timezone.utc) + timedelta(
        minutes=settings.verify_code_ttl_minutes
    )
    return code


@router.post("/google", response_model=TokenOut)
async def google_login(
    payload: GoogleAuthIn, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenOut:
    """Sign in / sign up with a Google account. Verifies the ID token, then
    upserts the user by Google subject (falling back to email) and returns a
    makan JWT. This is the only user-facing login method."""
    try:
        profile = verify_google_credential(payload.credential)
    except GoogleAuthError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))

    await _reject_if_banned(db, request, profile.email)

    user = await db.scalar(select(User).where(User.google_sub == profile.sub))
    if user is None:
        user = await db.scalar(select(User).where(User.email == profile.email))

    if user is None:
        user = User(
            name=profile.name,
            email=profile.email,
            google_sub=profile.sub,
            picture=profile.picture,
            role=await _resolve_role(db, profile.email),
        )
        db.add(user)
    else:
        # keep profile fresh; link google_sub to a pre-existing email account
        user.google_sub = profile.sub
        user.name = profile.name
        user.picture = profile.picture
        if user.email.lower() in settings.admin_email_set:
            user.role = UserRole.admin

    user.last_ip = client_ip(request)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id, user.role.value)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


# --- email + password with email verification code ---


@router.post("/register", response_model=RegisterOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)) -> RegisterOut:
    """Create an account and email a verification code. The account cannot log
    in until the code is confirmed via /auth/verify."""
    email = payload.email.lower()
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        if existing.email_verified:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
        # unverified account re-registering → refresh password + code
        existing.name = payload.name
        existing.hashed_password = hash_password(payload.password)
        user = existing
    else:
        user = User(
            name=payload.name,
            email=email,
            hashed_password=hash_password(payload.password),
            role=await _resolve_role(db, email),
            email_verified=False,
        )
        db.add(user)

    code = _issue_verification(user)
    await db.commit()

    sent = send_verification_email(email, code)
    dev_code = None
    if not sent and settings.expose_verify_code_in_dev:
        dev_code = code
    return RegisterOut(email=email, verification_required=True, dev_code=dev_code)


@router.post("/verify", response_model=TokenOut)
async def verify_email(
    payload: VerifyIn, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenOut:
    await _reject_if_banned(db, request, payload.email.lower())
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or user.verify_code is None or user.verify_expires is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No pending verification for this email")
    if datetime.now(timezone.utc) > user.verify_expires:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification code expired — request a new one")
    if payload.code.strip() != user.verify_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect verification code")

    user.email_verified = True
    user.verify_code = None
    user.verify_expires = None
    user.last_ip = client_ip(request)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.role.value)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/resend-code", response_model=RegisterOut)
async def resend_code(payload: ResendIn, db: AsyncSession = Depends(get_db)) -> RegisterOut:
    email = payload.email.lower()
    user = await db.scalar(select(User).where(User.email == email))
    # Don't reveal whether the email exists; always respond the same shape.
    if user is None or user.email_verified:
        return RegisterOut(email=email, verification_required=True, dev_code=None)
    code = _issue_verification(user)
    await db.commit()
    sent = send_verification_email(email, code)
    dev_code = code if (not sent and settings.expose_verify_code_in_dev) else None
    return RegisterOut(email=email, verification_required=True, dev_code=dev_code)


@router.post("/login", response_model=TokenOut)
async def login(
    payload: LoginIn, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenOut:
    await _reject_if_banned(db, request, payload.email.lower())
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or user.hashed_password is None or not verify_password(
        payload.password, user.hashed_password
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Email not verified. Check your inbox for the code."
        )

    user.last_ip = client_ip(request)
    await db.commit()
    token = create_access_token(user.id, user.role.value)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))
