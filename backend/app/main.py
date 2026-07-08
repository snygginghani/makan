import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import admin, ai, auth, categories, geo, knowledge, places, users
from app.core.config import get_settings
from app.core.net import client_ip
from app.core.rate_limit import limiter
from app.db.init_db import init_db
from app.db.session import async_session_factory
from app.services import bans

logging.basicConfig(level=logging.INFO)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="makan — Discover Jordan AI Map",
    description="AI-powered interactive map of Jordan with RAG-based place intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


async def _rate_limit_handler(request, exc: RateLimitExceeded):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Try again shortly."},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)


# Registered before CORS so the CORS middleware stays outermost (its headers are
# applied to the 403 too). Blocks any request coming from a banned IP address.
@app.middleware("http")
async def block_banned_ips(request, call_next):
    if request.method != "OPTIONS":  # let CORS preflight through
        ip = client_ip(request)
        if ip:
            async with async_session_factory() as session:
                if await bans.is_ip_banned(session, ip):
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Your IP address has been banned."},
                    )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Place photos (local storage mode)
Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(geo.router)
app.include_router(places.router)
app.include_router(ai.router)
app.include_router(knowledge.router)
app.include_router(admin.router)
app.include_router(users.router)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name}
