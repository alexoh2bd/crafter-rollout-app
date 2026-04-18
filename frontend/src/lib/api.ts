import type { CheckpointMeta } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  return res.json();
}

export async function createSession(
  mode: "human" | "agent" | "imagination",
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

export { API_URL };
