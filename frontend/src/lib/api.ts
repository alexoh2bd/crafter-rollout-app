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

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  return res.json();
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
  return res.json();
}

export async function closeSession(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: "DELETE" });
}

export async function listCheckpoints(): Promise<CheckpointMeta[]> {
  const res = await fetch(`${API_URL}/api/checkpoints`);
  if (!res.ok) throw new Error(`listCheckpoints failed: ${res.status}`);
  return res.json();
}

export async function downloadRollout(sessionId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/rollouts/${sessionId}/download`);
  if (!res.ok) throw new Error(`downloadRollout failed: ${res.status}`);
  return res.blob();
}

export async function listWMGoals(): Promise<WMGoalsResponse> {
  const res = await fetch(`${API_URL}/api/wm/goals`);
  if (!res.ok) throw new Error(`listWMGoals failed: ${res.status}`);
  const data = (await res.json()) as Partial<WMGoalsResponse>;
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
