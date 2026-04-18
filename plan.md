# Crafter Rollout Collector — Build Spec

You are building a web app that (1) lets users play random Crafter worlds in 
the browser, logging rollouts for use as training data, (2) demos trained 
policy checkpoints playing Crafter autonomously with real-time inference 
overlays, and (3) visualizes world-model imagination rollouts in latent space.

**Save this document as `docs/BUILD_SPEC.md` in the repo before starting.**
**After each PR, update `docs/DECISIONS.md` with any choices made that weren't 
in the spec.**

## Acceptance Criteria (build to satisfy these)

**Functional**
- User lands on the page and within 2 seconds can: start playing Crafter, 
  watch an agent play, or view a world-model imagination demo.
- Human play mode: WASD + number keys control agent, inventory/achievements 
  visible, rollouts auto-saved on session end.
- Agent demo mode: dropdown selects checkpoint, agent plays at user-adjustable 
  1–10 FPS, overlay shows action probabilities + value + latent novelty.
- Imagination demo mode: given current state, world model generates K=4 
  rollouts of length H=16 in latent space; each rollout decoded or visualized 
  as a PCA projection side-by-side with the real frame.
- Every timestep logged with: obs (base64 PNG), latent (128-d), action, 
  reward, inventory, achievements unlocked, source ("human" | "agent"), 
  checkpoint_id, action_probs (if agent).
- Rollouts downloadable as JSONL tarball; metadata queryable via REST.

**Quality**
- WebSocket stable for 30+ min sessions; auto-reconnect on drop.
- Agent demo FPS stable within ±10% of target.
- No memory leaks across 10+ session cycles.
- Keyboard-accessible; ARIA labels on interactive elements.
- Works on Chrome/Firefox/Safari desktop; shows "desktop recommended" banner 
  under 768px.

**Infra**
- Backend deployed on Railway, reachable at stable URL.
- Frontend deployed on Vercel, reachable at stable URL.
- Git history: ≥11 PRs merged to develop, ≥2 develop→main merges, 
  zero direct commits to main.

## Non-goals (do not build these)

- User authentication or accounts (anonymous UUIDs only)
- Mobile layouts (desktop-only, communicated clearly)
- Multiplayer or real-time collaboration
- Next.js (use Vite + React)
- Redux / Zustand / MobX (React state + hooks only)
- Streamlit, Gradio, Dash
- Custom design system (use Tailwind defaults)
- Auth providers, OAuth
- CI/CD beyond basic test-on-PR
- Self-hosted database (use Supabase or Railway Postgres)

## Pinned Dependencies

**Backend (requirements.txt):**
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
websockets==14.1
crafter==1.8.3
torch==2.5.1
numpy==2.1.3
pillow==11.0.0
pydantic==2.10.3
python-multipart==0.0.19
httpx==0.28.1
supabase==2.10.0
pytest==8.3.4
pytest-asyncio==0.25.0
ruff==0.8.4
```

**Frontend (package.json deps):**
```
react ^18.3.1
react-dom ^18.3.1
react-router-dom ^7.0.2
typescript ~5.6.2
vite ^6.0.3
tailwindcss ^3.4.17
@types/react ^18.3.17
@types/react-dom ^18.3.5
eslint ^9.17.0
```

## Interfaces (define these first, implement after)

```python
# backend/app/encoder.py
class Encoder:
    def __init__(self, checkpoint_path: str): ...
    def encode(self, obs: np.ndarray) -> np.ndarray:
        """obs: (64, 64, 3) uint8 → (128,) float32"""
        ...

# backend/app/policy.py
@dataclass
class ActionResult:
    action: int
    action_probs: np.ndarray      # (17,) float32
    value: float | None
    logits: np.ndarray            # (17,) float32

class Policy:
    def __init__(self, checkpoint_path: str, ckpt_type: str): ...
    def act(self, obs: np.ndarray) -> ActionResult: ...

class PolicyRegistry:
    @classmethod
    def get(cls, checkpoint_id: str) -> Policy: ...
    @classmethod
    def list_available(cls) -> list[CheckpointMeta]: ...

# backend/app/world_model.py  
class WorldModel:
    def __init__(self, checkpoint_path: str): ...
    def imagine(self, z0: np.ndarray, actions: np.ndarray, 
                horizon: int) -> np.ndarray:
        """z0: (128,), actions: (H,) int, → (H+1, 128) trajectory"""
        ...
    def sample_rollouts(self, z0: np.ndarray, K: int, 
                        horizon: int) -> np.ndarray:
        """Sample K random-action trajectories. → (K, H+1, 128)"""
        ...

# backend/app/game_session.py
class GameSession:
    mode: Literal["human", "agent", "imagination"]
    session_id: str
    seed: int
    env: crafter.Env
    def step_human(self, action: int) -> FrameMessage: ...
    async def run_agent_loop(self, checkpoint_id: str, fps: int): ...
    def imagine_rollouts(self, K: int, H: int) -> ImaginationMessage: ...
    def close(self): ...
```

## Golden-Path Data Format

One line of `rollout.jsonl`:
```json
{
  "step": 42,
  "obs": "iVBORw0KGgoAAAANS...",
  "latent": [0.123, -0.456, 0.789, "...128 floats total"],
  "action": 5,
  "action_name": "do",
  "reward": 1.0,
  "done": false,
  "inventory": {
    "health": 9, "food": 7, "drink": 6, "energy": 8,
    "sapling": 0, "wood": 3, "stone": 0, "coal": 0,
    "iron": 0, "diamond": 0,
    "wood_pickaxe": 1, "stone_pickaxe": 0, "iron_pickaxe": 0,
    "wood_sword": 0, "stone_sword": 0, "iron_sword": 0
  },
  "achievements_unlocked_this_step": ["collect_wood"],
  "source": "human",
  "checkpoint_id": null,
  "action_probs": null,
  "value_estimate": null,
  "seed": 12345,
  "timestamp": "2026-04-18T14:23:45.123Z"
}
```

Agent-mode line differs in `source: "agent"`, `checkpoint_id: "ppo-10m"`, 
`action_probs: [17 floats]`, `value_estimate: 2.3`.

## Repository Structure

```
crafter-rollout-collector/
├── vercel.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── game_session.py
│   │   ├── encoder.py
│   │   ├── policy.py
│   │   ├── world_model.py
│   │   ├── storage.py
│   │   ├── achievements.py
│   │   └── schemas.py
│   ├── checkpoints/
│   │   ├── manifest.json
│   │   ├── encoder_v0.pt        (placeholder, random init)
│   │   ├── policy_random.pt     (placeholder)
│   │   └── world_model_v0.pt    (placeholder)
│   ├── scripts/
│   │   ├── add_checkpoint.py
│   │   └── export_encoder.py
│   ├── tests/
│   │   ├── test_encoder.py
│   │   ├── test_policy.py
│   │   ├── test_storage.py
│   │   └── test_session.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── routes/
│   │   │   ├── Home.tsx
│   │   │   ├── Play.tsx
│   │   │   ├── Demo.tsx
│   │   │   └── Imagination.tsx
│   │   ├── components/
│   │   │   ├── GameCanvas.tsx
│   │   │   ├── ActionBar.tsx
│   │   │   ├── AchievementPanel.tsx
│   │   │   ├── InventoryDisplay.tsx
│   │   │   ├── CheckpointSelector.tsx
│   │   │   ├── AgentOverlay.tsx
│   │   │   ├── ImaginationPanel.tsx
│   │   │   ├── SpeedControl.tsx
│   │   │   ├── SessionControls.tsx
│   │   │   └── RolloutList.tsx
│   │   ├── hooks/
│   │   │   ├── useGameSession.ts
│   │   │   └── useWebSocket.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── pca.ts           (for latent visualization)
│   │   └── types.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vercel.json
├── .github/
│   ├── workflows/
│   │   ├── backend-ci.yml
│   │   └── frontend-ci.yml
│   └── pull_request_template.md
├── docs/
│   ├── BUILD_SPEC.md             (this document)
│   ├── DECISIONS.md              (append after each PR)
│   ├── ARCHITECTURE.md
│   ├── DATA_FORMAT.md
│   └── DEPLOYMENT.md
├── docker-compose.yml
├── README.md
└── .gitignore
```

## PR Sequence (stop for review after each)

**PR 1: Scaffold.** Repo structure, empty files, CI workflows, docs 
skeleton including BUILD_SPEC.md. develop branch created, main protected.

**PR 2: Backend core.** GameSession (human mode only), schemas, achievements 
module. Smoke test: can start a session, step 10 times, close. No WS yet.

**PR 3: Encoder inference.** Encoder class, placeholder CNN checkpoint, 
integration into GameSession so every step produces a latent. Test: 
latent is deterministic for a given obs.

**PR 4: Storage.** Rollout JSONL writer, metadata JSON, local filesystem 
dev mode + Supabase prod mode (feature-flagged by env var). Test: write a 
10-step rollout, reload, assert equality.

**PR 5: Policy inference + registry.** Policy interface, placeholder 
random-policy checkpoint, PolicyRegistry, manifest.json with 2 entries 
(random + label one as "placeholder — replace me"). Test: registry loads 
checkpoint, act() returns valid ActionResult.

**PR 6: World model inference.** WorldModel interface, placeholder (identity 
dynamics + noise, explicitly labeled) checkpoint, sample_rollouts method. 
Test: shapes are correct, rollouts are deterministic given seed.

**PR 7: FastAPI routes + WebSocket.** All REST endpoints, WS handler for 
human play + agent demo. Session lifecycle management. Concurrency limits 
(MAX_HUMAN_SESSIONS=5, MAX_PRIVATE_AGENT_SESSIONS=2). Shared agent demo 
broadcast. Integration test: spin up app, connect WS, play 10 steps.

**PR 8: Frontend scaffold + API client.** Vite + React + Tailwind + router 
set up. Home screen with 3-mode picker. Empty route components. api.ts 
and useWebSocket.ts. Deploys to Vercel preview.

**PR 9: Human play UI.** GameCanvas, ActionBar, InventoryDisplay, 
AchievementPanel, SessionControls. Full keyboard controls. End-to-end: 
user plays Crafter in browser, achievements unlock and animate.

**PR 10: Agent demo UI.** CheckpointSelector, AgentOverlay (action probs + 
value + novelty), SpeedControl. Shared session joining. End-to-end: user 
picks checkpoint, watches agent play with overlays.

**PR 11: Imagination UI.** ImaginationPanel showing 4 parallel rollouts. 
Use PCA (lib/pca.ts, project to 2D) to visualize latent trajectories as 
colored paths, with current real trajectory overlaid. Trigger button 
"Imagine from here" when in human play mode.

**PR 12: Deployment + polish.** Railway config (railway.json, Dockerfile 
finalized), Vercel config (vercel.json with API_URL env var), production 
Supabase setup, README with full deploy instructions, DEPLOYMENT.md. 
A11y pass, loading states, error boundaries.

## Deployment

**Backend on Railway:**
1. Push main to GitHub, connect Railway to repo.
2. Railway auto-detects Dockerfile in `backend/`. Set service root to `backend/`.
3. Environment variables: `SUPABASE_URL`, `SUPABASE_KEY`, `STORAGE_MODE=prod`, 
   `CORS_ORIGIN=https://<vercel-url>`.
4. Enable public networking, note the generated domain.
5. Healthcheck path: `/api/health`, expected status 200.

**Frontend on Vercel:**
1. Push main to GitHub, connect Vercel to this repo.
2. Either leave root directory at `.` and use root `vercel.json` (builds
   `frontend/`), or set root directory to `frontend/` with framework Vite (see
   [DEPLOYMENT.md](docs/DEPLOYMENT.md)).
3. Environment variables: `VITE_API_URL=https://<railway-url>`,
   `VITE_WS_URL=wss://<railway-url>` (Production and Preview).
4. Deploy. Main branch → production, PR branches → previews.

**Supabase setup:**
1. Create project, note URL and anon key.
2. Run SQL migration (in `backend/migrations/001_init.sql`) to create 
   `rollouts` and `achievement_events` tables.
3. Create storage bucket `rollouts` with public read, authenticated write.

## Git Protocol

- `main` protected, requires PR review, CI green.
- `develop` is integration branch.
- Feature branches from develop, named `feature/<area>-<short-desc>`, 
  e.g., `feature/backend-encoder`, `feature/frontend-agent-overlay`.
- PRs target develop. `develop → main` only via release PR after each 
  milestone (roughly every 3–4 feature PRs).
- Conventional commits required: `feat:`, `fix:`, `chore:`, `docs:`, 
  `test:`, `refactor:`.
- PR template requires: summary, testing done, screenshots for UI changes, 
  reference to acceptance criterion addressed.
- Every PR updates `docs/DECISIONS.md` with a one-line entry noting any 
  spec deviations.

## Testing Bar

- Every backend module has ≥1 smoke test that exercises the main interface.
- One integration test per feature (in `backend/tests/integration/`).
- Frontend: no unit tests for v1, but `tsc` + `eslint` + `vite build` must 
  pass in CI.
- Do not write tests for trivial getters/setters.
- Flakiness is a bug — retry loops in tests are not acceptable.

## Working Protocol

1. Read this spec fully before starting.
2. Propose PR 1, implement, open PR to develop, **stop and await review**.
3. After PR merges, move to next PR.
4. If a requirement is genuinely ambiguous, ask one question; otherwise 
   make a defensible choice and log it to DECISIONS.md.
5. If you find yourself writing code outside the repo structure or 
   interfaces above, stop — that's a spec change, raise it for review.
6. Keep each PR under 600 lines of diff where possible; split if larger.

Begin with PR 1.