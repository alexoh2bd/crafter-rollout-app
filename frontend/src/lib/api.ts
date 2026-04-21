// Cursor (AI-assisted).

import type { CheckpointMeta, WMGoalsResponse, SessionMode } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** True when the production bundle still targets localhost (common Vercel misconfig). */
export function isProductionBuildPointingAtLocalhost(): boolean {
  if (!import.meta.env.PROD) return false;
  try {
    const u = new URL(API_URL);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** WebSocket base URL: VITE_WS_URL, or derived from VITE_API_URL (http→ws, https→wss). */
function deriveWsBase(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit?.trim()) return explicit.replace(/\/$/, "");
  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
  const trimmed = api.replace(/\/$/, "");
  if (trimmed.startsWith("https://")) return "wss://" + trimmed.slice("https://".length);
  if (trimmed.startsWith("http://")) return "ws://" + trimmed.slice("http://".length);
  return "ws://localhost:8000";
}

export const WS_URL = deriveWsBase();

/** Read JSON from a fetch Response; if the body is HTML (SPA/404 page), throw a clear error. */
async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  const t = text.trim();
  if (
    t.startsWith("<!") ||
    t.toLowerCase().startsWith("<html") ||
    t.toLowerCase().startsWith("<!doctype")
  ) {
    throw new Error(
      "API returned HTML instead of JSON. Usually VITE_API_URL points at this Vercel site (or another " +
        "frontend), not your FastAPI backend. Set VITE_API_URL to your Railway API base URL " +
        "(https://…). On Vercel, add the same variable for Preview if deploy-branch previews fail while main works.",
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON from ${res.url}: ${msg}`);
  }
}

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`healthCheck failed: ${res.status}`);
  return (await parseJsonResponse(res)) as { status: string };
}
// ...
export async function createSession(
  mode: SessionMode,
  seed?: number,
): Promise<{ session_id: string; seed: number }> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, seed }),
  });
  if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
  return (await parseJsonResponse(res)) as { session_id: string; seed: number };
}

export async function closeSession(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: "DELETE" });
}

export async function listCheckpoints(): Promise<CheckpointMeta[]> {
  const res = await fetch(`${API_URL}/api/checkpoints`);
  if (!res.ok) throw new Error(`listCheckpoints failed: ${res.status}`);
  return (await parseJsonResponse(res)) as CheckpointMeta[];
}

export async function downloadRollout(sessionId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/rollouts/${sessionId}/download`);
  if (!res.ok) throw new Error(`downloadRollout failed: ${res.status}`);
  return res.blob();
}

export async function listWMGoals(): Promise<WMGoalsResponse> {
  const res = await fetch(`${API_URL}/api/wm/goals`);
  if (!res.ok) throw new Error(`listWMGoals failed: ${res.status}`);
  const data = (await parseJsonResponse(res)) as Partial<WMGoalsResponse>;
  return {
    goals: data.goals ?? [],
    wm_base_available: data.wm_base_available ?? false,
    hwm_available: data.hwm_available ?? false,
    checkpoint_source: data.checkpoint_source ?? "none",
    s3_prefix: data.s3_prefix ?? null,
    latent_dim: data.latent_dim ?? null,
  };
}

export { API_URL };
