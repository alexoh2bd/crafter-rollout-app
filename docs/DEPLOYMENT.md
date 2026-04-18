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

1. Push `main` to GitHub, connect Vercel to the repo.
2. Set root directory to `frontend/`, framework preset: **Vite**.
3. Set environment variables:
   - `VITE_API_URL=https://<your-railway-url>`
   - `VITE_WS_URL=wss://<your-railway-url>`
4. Deploy. `main` branch → production; PR branches → preview deployments.

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
