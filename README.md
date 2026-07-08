# Makan - Discover Jordan AI Map

AI-powered interactive map of Jordan with RAG-based place intelligence.
Users explore viewpoints, mountains, valleys, waterfalls, trails, camps, cafes, restaurants, study areas, and hidden gems. 

## Core Concept: Context-Aware Location Discovery
The primary innovation of Makan is an intelligent AI assistant designed to dynamically recommend sites and activities based on user-specific needs and their current location. By analyzing requirements (e.g., family-friendly, best time for photography) alongside geographic proximity, the system queries a highly curated, per-location knowledge base to deliver accurate and hyper-localized recommendations.

## Architecture

```text
User Query ──▶ Next.js  ──▶ FastAPI ──▶ RAG Pipeline ──▶ DeepSeek LLM
                                        │             │
                                        ▼             ▼
                                  PostgreSQL ◀── pgvector similarity search
                                        ▲
                     Admin JSON upload ─┘ (QA chunking → embeddings)
```

| Layer     | Tech |
|-----------|------|
| Frontend  | Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui (RTL), react-map-gl (Mapbox GL / MapLibre fallback) |
| Backend   | FastAPI, SQLAlchemy 2 (async), Pydantic v2, Uvicorn |
| Database  | PostgreSQL 16 + pgvector (HNSW index, cosine distance) |
| AI        | OpenRouter: `deepseek/deepseek-v4-flash` (chat) + `google/gemini-embedding-2` (1536-dim embeddings); offline deterministic fallback without keys |
| Storage   | Local dir for knowledge JSON (S3-swappable), Cloudinary for media |
| Auth      | JWT (PyJWT + bcrypt), role-based access (user/admin) |

## Quickstart (local)

```bash
# 1. Database (Postgres + pgvector)
docker compose up -d db

# 2. Backend
cd backend
pip install -r requirements.txt        # or: uv pip install -r requirements.txt
cp .env.example .env                   # fill in DEEPSEEK_API_KEY etc. (optional)
python -m app.seed.seed                # tables + admin + 150 places + knowledge index
python -m uvicorn app.main:app --port 8000

# 3. Frontend
cd ../frontend
npm install
npm run dev                            # http://localhost:3000
```

Seeded admin: `admin@makan.jo` / `admin123456` (**change in production**).
The first user to register also becomes admin (bootstrap rule).

Runs fully offline out of the box: without `DEEPSEEK_API_KEY` the RAG pipeline
composes answers deterministically from retrieved chunks; without
`NEXT_PUBLIC_MAPBOX_TOKEN` the map uses the free Carto dark basemap (MapLibre).
Add both keys for production quality.

### Tests

```bash
docker compose up -d db
cd backend && python -m pytest tests -q      # 23 tests: auth, CRUD, RAG, knowledge
```

## RAG pipeline

1. **Admin upload** — `POST /admin/knowledge/upload-json?place_id=…` validates the
   JSON (schema + 2 MB limit), stores the raw file, splits QA pairs (+ description
   + tags) into chunks, prefixes each with the place identity, batch-embeds them,
   and stores vectors in `knowledge_chunks` (pgvector).
2. **Query** — `POST /ai/query` embeds the question, runs cosine-distance search
   joined with metadata filters (category, tags, haversine radius when lat/lng
   given), groups top chunks per place, and builds a context block.
3. **LLM** — DeepSeek receives the context with a strict system prompt and must
   return structured JSON: `{answer, places[{id,name,reason,distance_km}], map_highlight_ids}`.
4. **Guardrails in code, not just prompt** — returned place ids are intersected
   with the retrieved set (hallucinated places dropped), coordinates always come
   from the DB, and a deterministic offline answer is used if the LLM fails.

### Knowledge file format

```json
{
  "place_id": 123,
  "name": "مطل عجلون",
  "category": "viewpoint",
  "qa": [
    {"q": "هل المكان مناسب للعائلات؟", "a": "نعم مناسب جداً ويوجد جلسات آمنة."},
    {"q": "أفضل وقت للزيارة؟", "a": "وقت الغروب هو الأفضل."}
  ],
  "tags": ["غروب", "تصوير", "جبال"]
}
```

## API overview

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /auth/register` | — | Email/password sign-up → emails a 6-digit code (returns `dev_code` when SMTP unset). Admin if email in `ADMIN_EMAILS`. |
| `POST /auth/verify`, `POST /auth/resend-code` | — | Confirm the emailed code (returns JWT) / resend it |
| `POST /auth/login` | — | Email/password (requires a verified email) |
| `POST /auth/google` | — | Google Sign-In (works on localhost/HTTPS domains, **not** LAN IPs — Google rejects those origins) |
| `GET /places` | optional | Filters: `q, category, tags, region, lat/lng/radius_km, bbox`, pagination |
| `GET /places/{id}` | optional | Detail + QA knowledge + favorite flag |
| `POST/PUT/DELETE /places…` | admin | CRUD (delete cascades knowledge) |
| `POST /places/{id}/images` | admin | Upload photos (multipart, ≤8MB each; local `/media` or Cloudinary) |
| `DELETE /places/{id}/images?url=…` | admin | Remove a photo |
| `POST /places/{id}/favorite` | user | Favorites (`GET /me/favorites`) |
| `GET/POST /places/{id}/reviews` | public/user | Ratings (1–5) + comments; one per user (upsert), aggregates on Place |
| `GET /categories` | — | Public category list (admin-managed, drives map filters) |
| `POST /uploads/images` | user | Photo upload for place suggestions (mandatory ≥1 photo per suggestion) |
| `POST /ai/query` | — (rate-limited) | RAG query → structured answer + map highlights |
| `POST /admin/knowledge/upload-json` | admin | Upload + index knowledge JSON |
| `POST /admin/knowledge/reindex/{place_id}` | admin | Re-embed from stored raw JSON |
| `POST /submissions` / `GET /submissions/mine` | user | Community place suggestions |
| `GET /admin/submissions`, `POST …/review` | admin | Approve (creates Place) / reject with note |
| `POST /reports` / `GET /admin/reports` | user/admin | Wrong-info reports + resolution |
| `GET /admin/analytics` | admin | Dashboard stats |
| `GET/POST/DELETE /admin/categories` | admin | Category management |

Interactive docs: `http://localhost:8000/docs`.

## Data honesty

Seeded coordinates are **approximate** (area-level) and stored with
`coords_verified=false`. The UI shows "الموقع تقريبي" until an admin verifies
exact coordinates via the dashboard (checkbox in the place form).

## Security

- JWT (HS256) with configurable expiry; bcrypt password hashing
- Role-based dependencies (`require_admin`) on all mutating/admin routes
- Knowledge uploads: content-type check, 2 MB cap, strict Pydantic schema
- `/ai/query` rate-limited (slowapi, default `10/minute`, env-configurable)
- CORS restricted to `CORS_ORIGINS`
- Unapproved places invisible to non-admins

## Deployment

### Backend (Docker)

```bash
docker compose --profile full up -d --build   # db + api on :8000
```

### Accessing from other devices (phones/tablets) on your WiFi

1. Run the backend bound to all interfaces: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   (the frontend `next dev` already binds `0.0.0.0`).
2. Open **PowerShell as Administrator** once to allow inbound traffic:
   ```powershell
   New-NetFirewallRule -DisplayName "makan" -Direction Inbound -Protocol TCP -LocalPort 3000,8000 -Action Allow -Profile Private
   ```
3. On the phone, open `http://<your-PC-LAN-IP>:3000` (e.g. `http://192.168.1.24:3000`).
   The frontend auto-targets the backend on the same host, and CORS already allows LAN origins.

> Google Sign-In won't work over a LAN IP (Google only allows `localhost` and real
> HTTPS domains as origins) — use **email + password** on phones, or serve the app
> over an HTTPS domain for Google.

Or deploy `backend/Dockerfile` anywhere (Fly.io, Railway, ECS…). Point
`DATABASE_URL` at a managed Postgres with pgvector (Neon, Supabase, RDS +
`CREATE EXTENSION vector` — the app creates the extension and HNSW index at
startup if it has privileges).

Production env checklist (`backend/.env.example`):
`DATABASE_URL`, `JWT_SECRET` (long random), `CORS_ORIGINS` (your Vercel URL),
`DEEPSEEK_API_KEY`, `EMBEDDING_PROVIDER=openai_compatible` + `EMBEDDING_API_KEY`,
`CLOUDINARY_URL`, `AI_RATE_LIMIT`.

> Changing `EMBEDDING_MODEL`/`EMBEDDING_DIM` requires re-running
> `POST /admin/knowledge/reindex/{place_id}` per place (dim change also needs a
> column migration — vectors are fixed-width).

### Frontend (Vercel)

1. Import the repo, set **Root Directory** to `frontend/`.
2. Env vars: `NEXT_PUBLIC_API_URL=https://your-api.example.com`,
   `NEXT_PUBLIC_MAPBOX_TOKEN=pk.…` (optional but recommended).
3. Deploy — Next.js 16 App Router works out of the box.

## Project layout

```text
backend/
  app/
    main.py            # FastAPI app, CORS, rate limit, routers
    models.py          # SQLAlchemy models (pgvector columns)
    schemas.py         # Pydantic I/O schemas
    api/routes/        # auth, places, ai, knowledge, admin, users
    services/          # embeddings, llm, rag, knowledge, geo
    seed/              # 150 places + knowledge JSONs + seed script
  tests/               # pytest suite (real Postgres)
frontend/
  app/                 # / (map), /places/[id], /login, /register, /suggest, /admin
  components/
    map/               # map engines, pins, popup, search, filters, basemap
    chat/              # location-aware AI chat panel
    place/             # place card, detail view, gallery, reviews, actions
    layout/            # nav, theme toggle
    admin/             # dashboard panels (places, categories, submissions…)
    ui/                # shadcn primitives
  components/          # map (mapbox+maplibre), chat, admin panels, shadcn/ui
  design-system/       # MASTER.md — design tokens & rules
  lib/                 # api client, types, categories, auth hook
docker-compose.yml     # db (pgvector) + api (profile: full)
```
