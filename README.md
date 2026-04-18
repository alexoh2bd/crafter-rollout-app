# crafter-rollout-collector

A web app for collecting human and agent rollouts in [Crafter](https://github.com/danijar/crafter),
demoing trained policy checkpoints, and visualizing world-model imagination rollouts.

> **WIP** — See [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md) for the full specification.

## Modes

- **Human play** — Play Crafter in the browser; rollouts auto-saved on session end.
- **Agent demo** — Watch a trained policy play with real-time inference overlays.
- **Imagination demo** — Visualize world-model latent rollouts side-by-side with the real frame.

## Docs

- [Build Spec](docs/BUILD_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data Format](docs/DATA_FORMAT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Decisions](docs/DECISIONS.md)

## Quick start

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deploy instructions (Railway + Vercel + Supabase).

```bash
# Backend (dev)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (dev)
cd frontend
npm install
npm run dev
```

## Stack

- **Backend**: FastAPI · uvicorn · Crafter · PyTorch · Supabase · Railway
- **Frontend**: Vite · React 18 · TypeScript · Tailwind CSS · Vercel
