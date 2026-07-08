# Deploying makan

makan is two deployables: a **Next.js frontend** (perfect for Vercel) and a
**FastAPI backend + PostgreSQL/pgvector** (Vercel can't host these well, so use a
container host + managed Postgres). Total cost can be $0 on free tiers.

```
[ Vercel ]  makan.vercel.app   →   [ Render/Railway/Fly ]  api.makan.xyz
  Next.js frontend                    FastAPI backend
                                          │
                                    [ Neon / Supabase ]  Postgres + pgvector
```

---

## 1. Database — managed Postgres with pgvector

Use **Neon** (neon.tech) or **Supabase** — both free and support the `vector`
extension.

1. Create a project → copy the connection string.
2. Convert it to the async driver the app expects:
   `postgresql://…` → `postgresql+asyncpg://…`
3. That's it — the app runs `CREATE EXTENSION IF NOT EXISTS vector` and all
   migrations automatically on first boot.

> Neon note: append `?sslmode=require` is handled by asyncpg via `ssl=true`; if
> you hit SSL errors, use the "pooled" connection string Neon provides.

---

## 2. Backend — Render (simplest) / Railway / Fly.io

The repo already has [`backend/Dockerfile`](backend/Dockerfile).

**Render** (render.com):
1. New → **Web Service** → connect the repo, set **Root Directory** = `backend`.
2. Runtime: Docker. It picks up the Dockerfile automatically.
3. Add environment variables (see the table below).
4. Deploy. Note the public URL, e.g. `https://makan-api.onrender.com`.

**Backend environment variables:**

| Var | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql+asyncpg://…` from step 1 |
| `JWT_SECRET` | a long random string |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://makan.vercel.app` |
| `GOOGLE_CLIENT_ID` | your OAuth client id (Google-only login) |
| `ADMIN_EMAILS` | your email(s), comma-separated → auto-admin |
| `DEEPSEEK_API_KEY` | OpenRouter key |
| `DEEPSEEK_BASE_URL` | `https://openrouter.ai/api/v1` |
| `DEEPSEEK_CHAT_MODEL` | `deepseek/deepseek-v4-flash` |
| `EMBEDDING_PROVIDER` | `openai_compatible` |
| `EMBEDDING_API_KEY` | OpenRouter key |
| `EMBEDDING_BASE_URL` | `https://openrouter.ai/api/v1` |
| `EMBEDDING_MODEL` | `google/gemini-embedding-2` |
| `EMBEDDING_DIM` | `1536` |
| `CLOUDINARY_URL` | `cloudinary://key:secret@cloud` (photos survive redeploys) |

> **Photos:** the container filesystem is ephemeral on Render/Railway, so set
> `CLOUDINARY_URL` in production — uploads then go to Cloudinary instead of local
> disk automatically. (Knowledge JSON is stored in the DB, so it's safe already.)

The start command is baked into the Dockerfile (`uvicorn app.main:app --host
0.0.0.0 --port 8000`); Render sets `$PORT` — if your host needs it, change the
CMD to `--port ${PORT:-8000}`.

---

## 3. Frontend — Vercel

1. Import the repo at vercel.com → **Root Directory** = `frontend`.
2. Framework preset: **Next.js** (auto-detected). No build config needed.
3. Environment variables:

| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | your backend URL, e.g. `https://makan-api.onrender.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | your OAuth client id |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | optional (falls back to free basemaps) |

4. Deploy → you get `https://makan.vercel.app`.

> `NEXT_PUBLIC_API_URL` **must** be set in production (unlike local dev, where the
> app auto-targets the same host). Without it the frontend would call the Vercel
> domain for the API and fail.

---

## 4. Google Sign-In — authorize the production origin

This is the step people forget. In
[Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
→ your OAuth 2.0 Client → **Authorized JavaScript origins**, add your real URL:

```
https://makan.vercel.app
```

(Google only accepts `localhost` and HTTPS domains — never LAN IPs. On Vercel you
have a real HTTPS domain, so Google Sign-In works.) Also add any custom domain
you attach later. Changes take a few minutes to propagate.

---

## 5. First run

1. Open `https://makan.vercel.app` → **Sign in with Google**.
2. Because your email is in `ADMIN_EMAILS`, you're an admin. Pick a username on
   the onboarding screen.
3. Go to **الإدارة / Admin** → add categories (or run the seed once locally
   against the production DB: `DATABASE_URL=… python -m app.seed.seed`), then add
   places and upload knowledge JSON files.

---

## Local development (recap)

```bash
docker compose up -d db                       # Postgres + pgvector
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
cd ../frontend && npm install && npm run dev  # http://localhost:3000
```

Google Sign-In works on `http://localhost:3000` once that origin is authorized in
Google Console. On a phone over your LAN, use the LAN IP — but note Google login
won't work there (LAN IPs can't be Google origins); deploy to Vercel for phones.
