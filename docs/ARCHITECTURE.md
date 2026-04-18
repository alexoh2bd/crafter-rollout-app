# Architecture

_Full architecture documented after PR 7 (FastAPI routes + WebSocket)._

## Overview (placeholder)

```
Browser (Vite/React/Tailwind — Vercel)
        │  HTTPS REST + WSS
        ▼
FastAPI backend (Railway)
  ├── GameSession  ← Crafter env
  ├── Encoder      ← latent vectors
  ├── Policy       ← action selection
  ├── WorldModel   ← imagination rollouts
  └── Storage      ← JSONL + Supabase
```

See [BUILD_SPEC.md](BUILD_SPEC.md) for interfaces and the PR sequence.
