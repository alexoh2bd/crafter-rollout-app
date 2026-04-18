# Deployment

## Backend on Railway

1. Push `main` to GitHub, connect Railway to the repo.
2. Railway auto-detects `Dockerfile` in `backend/`. Set the service root to `backend/`.
3. Set environment variables:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_KEY` — your Supabase anon key
   - `STORAGE_MODE=prod`
   - `CORS_ORIGIN=https://<your-vercel-url>`
4. Enable public networking and note the generated domain.
5. Healthcheck path: `/api/health`, expected status 200.

## Frontend on Vercel

### Option A — This repository root (recommended)

The repository root (`crafter-rollout-app`) contains a `vercel.json` that
configures install, build, output directory, and SPA rewrites for the Vite app
under `frontend/`, so no dashboard overrides are needed.

1. Push `main` to GitHub, connect Vercel to **this** repository.
2. Leave **Root Directory** as `.` (repository root). Vercel reads
   `vercel.json` at the root automatically.
3. Set environment variables in **Production** *and* **Preview** scopes
   (Vite inlines them at build time, so they must exist before the build runs):
   - `VITE_API_URL=https://<your-railway-url>`
   - `VITE_WS_URL=wss://<your-railway-url>`
4. Deploy. `main` → production; PR branches → preview deployments.

### Option B — Root Directory `frontend`

If you prefer to point Vercel only at the frontend package:

1. In **Vercel → Project → Settings → General → Root Directory**, set:
   `frontend`
2. Framework preset: **Vite**. Output Directory: `dist` (default for Vite).
3. Set the same `VITE_API_URL` and `VITE_WS_URL` environment variables as above.
4. Deploy.

`frontend/vercel.json` holds the SPA rewrite rule (`/* → /index.html`) for
React Router deep links when using Option B. Option A applies the same rewrites
from the root `vercel.json`.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) and note the URL and anon key.
2. Open the SQL editor and run `backend/migrations/001_init.sql` to create the
   `rollouts` and `achievement_events` tables.
3. Create a storage bucket named `rollouts` with **public read** and
   **authenticated write** permissions.

## Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
STORAGE_MODE=local uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
VITE_API_URL=http://localhost:8000 VITE_WS_URL=ws://localhost:8000 npm run dev
```

## Docker Compose (backend only)

```bash
docker compose up --build
```

The backend service is exposed on port 8000.
