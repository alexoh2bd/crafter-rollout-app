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

### Policy checkpoints (volume + upload)

- **Persist weights on Railway:** attach a volume and set `CHECKPOINTS_DIR` to the mount path (for example `/checkpoints`). On first boot, if that directory has no `manifest.json`, the server copies the bundled [`backend/checkpoints/manifest.json`](backend/checkpoints/manifest.json) from the image so entries like `ppo_teacher` are registered.
- **Upload API:** `POST /api/checkpoints/upload` (multipart form: `file`, `checkpoint_id`, `display_name`, optional `ckpt_type`, `description`) writes a file named `{checkpoint_id}.pt` under `CHECKPOINTS_DIR` and upserts `manifest.json`. Set `CHECKPOINT_UPLOAD_SECRET` in Railway and send the same value in the `X-Upload-Secret` header. If the secret is unset, upload returns 503 (disabled by default).
- **Local dev:** place `ppo_teacher.pt` in `backend/checkpoints/` next to `manifest.json` (the `ppo_teacher` entry points at `ppo_teacher.pt`). Binary `*.pt` files are gitignored; only the manifest ships in git.

Example:

```bash
curl -X POST "https://YOUR_RAILWAY_URL/api/checkpoints/upload" \
  -H "X-Upload-Secret: $CHECKPOINT_UPLOAD_SECRET" \
  -F "checkpoint_id=ppo_teacher" \
  -F "display_name=PPO Teacher" \
  -F "ckpt_type=ppo" \
  -F "file=@ppo_teacher.pt"
```

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
