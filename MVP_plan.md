# Crafter Rollout Collector — Weekend MVP Spec

Weekend build: simple web app to play Crafter in the browser, log rollouts, 
and demo a trained policy playing autonomously with inference overlays.

## Acceptance Criteria

**Functional**
- Landing page with toggle: "Play" | "Watch AI"
- Play mode: WASD + number keys control agent in a 64×64 Crafter env 
  rendered on a 512×512 canvas. Inventory and achievements visible. 
  Rollout auto-saved on session end, downloadable.
- Watch AI mode: dropdown selects a policy checkpoint. Agent plays at 
  4 FPS. Overlay shows action probability bar chart for the 17 actions.
- Every timestep logged: obs (raw bytes), action, reward, inventory, 
  achievements unlocked, source ("human"|"agent"), checkpoint_id, 
  action_probs (if agent), timestamp.
- Download endpoint returns a JSONL tarball of a rollout.

**Infra**
- Backend on Railway, frontend on Vercel. Both publicly reachable.
- Branch protection on `main`; feature branches → PR → `develop` → PR → `main`.

## Non-Goals

Authentication, user accounts, mobile, Next.js, Redux, Supabase, 
world-model imagination demo, CI workflows beyond branch protection, 
comprehensive tests, multi-route SPA, shared demo sessions, encoder 
inference in the serving path.

## Pinned Deps

**backend/requirements.txt:**
## Revised Architecture
```
crafter-rollout-collector/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, all routes in one file
│   │   ├── session.py           # GameSession class
│   │   ├── policy.py            # Policy loader + inference
│   │   └── storage.py           # SQLite + filesystem JSONL
│   ├── checkpoints/
│   │   ├── manifest.json
│   │   └── policy_random.pt     # placeholder, real one later
│   ├── data/                    # SQLite DB + rollout JSONLs (volume mount)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # everything in one component tree, one route
│   │   ├── main.tsx
│   │   ├── GameView.tsx         # canvas + action bar + HUD
│   │   ├── AgentOverlay.tsx     # action probs bar chart
│   │   ├── api.ts               # REST + WS client
│   │   └── types.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── vercel.json
├── .github/
│   └── pull_request_template.md
├── docs/
│   ├── BUILD_SPEC.md
│   └── DECISIONS.md
└── README.md
```