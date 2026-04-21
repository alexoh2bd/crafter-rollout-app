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
## Current Repo Structure

```
crafter-rollout-collector/          ← this repo
├── vercel.json                     ✅ root config: builds frontend/
├── railway.json                    ✅ root Railway config (mirrors backend/)
├── Dockerfile                      ✅ root Dockerfile (mirrors backend/)
├── backend/
│   ├── app/
│   │   ├── main.py                 ✅ all routes + WS handlers
│   │   ├── game_session.py         ✅ GameSession, step_human, obs→base64
│   │   ├── policy.py               ✅ PolicyRegistry, random-policy placeholder
│   │   ├── storage.py              ✅ RolloutWriter (JSONL) + MetadataStore (SQLite)
│   │   ├── achievements.py         ✅ achievement names + diff
│   │   ├── schemas.py              ✅ Pydantic schemas
│   │   └── encoder.py / world_model.py   ✅ stubs (out of MVP scope)
│   ├── checkpoints/
│   │   ├── manifest.json           ✅
│   │   └── *.pt.placeholder        ✅ (real weights TBD — PR 4)
│   ├── tests/                      ✅ test_session, test_policy, test_storage …
│   ├── requirements.txt            ✅
│   ├── Dockerfile                  ✅
│   └── railway.json                ✅
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 ✅ router with /, /play, /demo, /imagination
│   │   ├── main.tsx                ✅
│   │   ├── routes/
│   │   │   ├── Home.tsx            ⬜ stub — PR 2
│   │   │   ├── Play.tsx            ⬜ stub — PR 2
│   │   │   ├── Demo.tsx            ⬜ stub — PR 2
│   │   │   └── Imagination.tsx     ⬜ out of MVP scope
│   │   ├── components/
│   │   │   ├── GameCanvas.tsx      ⬜ stub — PR 2
│   │   │   ├── ActionBar.tsx       ⬜ stub — PR 2
│   │   │   ├── AchievementPanel.tsx ⬜ stub — PR 2
│   │   │   ├── InventoryDisplay.tsx ⬜ stub — PR 2
│   │   │   ├── AgentOverlay.tsx    ⬜ stub — PR 2
│   │   │   ├── CheckpointSelector.tsx ⬜ stub — PR 2
│   │   │   ├── SessionControls.tsx ⬜ stub — PR 2
│   │   │   └── SpeedControl.tsx    ⬜ stub — PR 2
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts     ⬜ stub — PR 2
│   │   │   └── useGameSession.ts   ⬜ stub — PR 2
│   │   ├── lib/
│   │   │   ├── api.ts              ⬜ only healthCheck — PR 2
│   │   │   └── pca.ts              ⬜ out of MVP scope
│   │   └── types.ts                ✅ (likely stub — verify in PR 2)
│   ├── package.json / vite.config.ts / tailwind.config.js   ✅
│   └── vercel.json                 ✅ SPA rewrite for Option B
├── .github/
│   ├── workflows/backend-ci.yml + frontend-ci.yml   ✅
│   └── pull_request_template.md    ✅
├── docs/                           ✅
└── README.md                       ✅ (no live URLs yet — PR 3)
```


## PRs

Four PRs total. Stop and await review after each.

**PR 1 — Backend + scaffold.** ✅ DONE. All backend modules implemented 
(`main.py`, `game_session.py`, `policy.py`, `storage.py`, `achievements.py`, 
`schemas.py`). Routes: `POST /api/sessions`, `DELETE /api/sessions/{id}`, 
`WS /ws/{session_id}`, `GET /api/rollouts/{id}/download`, 
`GET /api/checkpoints`, `GET /api/health`. SQLite metadata store + JSONL 
writer. Random-policy placeholder. Frontend scaffold with router, stub routes 
and components, `lib/api.ts` with `healthCheck` only.

**PR 2 — Frontend UI.** Implement every stub in `frontend/src/`. 

- `lib/api.ts`: add `createSession`, `closeSession`, `listCheckpoints`, 
  `downloadRollout`. Export `WS_URL`.
- `hooks/useWebSocket.ts`: open/close WS, send action, receive `FrameMessage`.
- `hooks/useGameSession.ts`: orchestrate session create → WS connect → step 
  loop → close; expose `state`, `send`, `download`.
- `routes/Home.tsx`: landing page with "Play" and "Watch AI" buttons linking 
  to `/play` and `/demo`.
- `routes/Play.tsx`: human play mode — mounts `GameCanvas`, `ActionBar`, 
  `InventoryDisplay`, `AchievementPanel`, `SessionControls`. Keyboard handler 
  maps WASD + number keys to action indices 0–16. Auto-saves on session end.
- `routes/Demo.tsx`: agent demo — `CheckpointSelector` dropdown, 
  `GameCanvas`, `AgentOverlay` (17-action bar chart), `SpeedControl`, 
  `SessionControls`.
- All components: implement with real props (no TODOs left).
- End-to-end check: `VITE_API_URL=http://localhost:8000 npm run dev`, play 
  10 steps, achievements appear, download JSONL tarball.

**PR 3 — Deploy.** Backend to Railway, frontend to Vercel. 
- Confirm `backend/Dockerfile` copies `data/` volume mount dir; add 
  `DATA_DIR=/data` env var in Railway. 
- Set `CORS_ORIGIN=https://<vercel-url>` in Railway.
- Set `VITE_API_URL` and `VITE_WS_URL` in Vercel (Production + Preview).
- Verify `/api/health` returns `{"status":"ok"}` at the Railway public URL.
- Verify frontend loads at the Vercel URL and Play mode works end-to-end.
- Update README with live Railway URL and Vercel URL.

**PR 4 — Polish.** Error boundaries around `GameCanvas` and WS hooks. 
Loading spinners while session initialises. Download button shows filename 
and file size. Swap in real PPO checkpoint weights for the random placeholder 
(update `manifest.json`). Final release: `develop → main`.

## Working Protocol

1. PR 1 is merged (or in-progress on `feature/backend`). 
2. Next session: implement PR 2 on branch `feature/frontend`. Open PR to 
   `develop`. Stop for review.
3. Continue: PR 3 on `feature/deploy`, PR 4 on `feature/polish`.
4. If you need to deviate from the spec, log a line in DECISIONS.md 
   and proceed.
5. No tests beyond one smoke test per backend module. No new CI workflows.
6. Keep PRs under 800 lines of diff.
7. Skip `Imagination.tsx` and `ImaginationPanel.tsx` — out of MVP scope.