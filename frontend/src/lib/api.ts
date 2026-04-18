/**
 * REST API client.
 * Base URL read from import.meta.env.VITE_API_URL (set in .env / Vercel).
 * Implemented in PR 8.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  return res.json();
}

// TODO: add session, checkpoint, and rollout endpoints (PR 8)

export { API_URL };
