// Cursor (AI-assisted).

import { useCallback, useEffect, useRef, useState } from "react";
import type { FrameMessage, SessionMode } from "../types";
import {
  closeSession,
  createSession,
  downloadRollout,
  WS_URL,
} from "../lib/api";
import { useWebSocket } from "./useWebSocket";

export type SessionPhase = "idle" | "connecting" | "playing" | "done" | "error";

export interface StartOpts {
  // agent mode
  checkpointId?: string;
  fps?: number;
  // wm_base / hwm modes
  wmAchievement?: string;
  wmHLo?: number;
  wmHHi?: number;
  wmNSamples?: number;
  wmNIters?: number;
}

export interface UseGameSessionReturn {
  phase: SessionPhase;
  frame: FrameMessage | null;
  error: string | null;
  start: (opts?: StartOpts) => Promise<void>;
  sendAction: (action: number) => void;
  stop: () => void;
  download: () => void;
}

export function useGameSession(mode: SessionMode): UseGameSessionReturn {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const optsRef = useRef<StartOpts>({});
  const initSentRef = useRef(false);

  const { send, lastFrame, lastError, status } = useWebSocket(wsUrl);

  // New TCP connection: allow init to be sent again (fixes React StrictMode remounts).
  useEffect(() => {
    if (status === "connecting") {
      initSentRef.current = false;
    }
  }, [status]);

  // Transition from "connecting" → "playing" once WS opens, send mode-specific init msg
  useEffect(() => {
    if (status === "open" && phase === "connecting") {
      if (!initSentRef.current) {
        initSentRef.current = true;

        if (mode === "agent") {
          send({
            checkpoint_id: optsRef.current.checkpointId ?? "random",
            fps: optsRef.current.fps ?? 4,
          });
        } else if (mode === "wm_base") {
          send({
            achievement: optsRef.current.wmAchievement ?? "",
            H_lo: optsRef.current.wmHLo ?? 10,
            n_samples: optsRef.current.wmNSamples ?? 100,
            n_iters: optsRef.current.wmNIters ?? 3,
          });
        } else if (mode === "hwm") {
          send({
            achievement: optsRef.current.wmAchievement ?? "",
            H_lo: optsRef.current.wmHLo ?? 10,
            H_hi: optsRef.current.wmHHi ?? 3,
            n_samples: optsRef.current.wmNSamples ?? 100,
            n_iters: optsRef.current.wmNIters ?? 3,
          });
        }
      }
      setPhase("playing");
    }
    if (status === "closed" && phase === "playing") {
      setPhase(lastError ? "error" : "done");
    }
    if (status === "closed" && phase === "connecting") {
      if (lastError) setPhase("error");
      else setPhase("idle");
    }
    if (status === "error") {
      setPhase("error");
    }
  }, [status, phase, mode, send, lastError]);

  // Server sent {"error": "..."} over WS — tear down and surface message
  useEffect(() => {
    if (!lastError) return;
    setPhase("error");
    setWsUrl(null);
    if (sessionIdRef.current) {
      closeSession(sessionIdRef.current).catch(() => {});
    }
  }, [lastError]);

  // When a frame with done===true arrives, close up
  useEffect(() => {
    if (lastFrame?.done && phase === "playing") {
      setPhase("done");
      setWsUrl(null);
      if (sessionIdRef.current) {
        closeSession(sessionIdRef.current).catch(() => {});
      }
    }
  }, [lastFrame, phase]);

  const start = useCallback(
    async (opts: StartOpts = {}) => {
      if (phase !== "idle" && phase !== "done" && phase !== "error") return;
      optsRef.current = opts;
      initSentRef.current = false;
      setPhase("connecting");
      const { session_id } = await createSession(mode);
      sessionIdRef.current = session_id;
      setWsUrl(`${WS_URL}/ws/${session_id}`);
    },
    [mode, phase],
  );

  const sendAction = useCallback(
    (action: number) => {
      if (phase === "playing") {
        send({ action });
      }
    },
    [phase, send],
  );

  const stop = useCallback(() => {
    setWsUrl(null);
    setPhase("done");
    if (sessionIdRef.current) {
      closeSession(sessionIdRef.current).catch(() => {});
    }
  }, []);

  const download = useCallback(() => {
    if (!sessionIdRef.current) return;
    downloadRollout(sessionIdRef.current).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rollout_${sessionIdRef.current}.tar.gz`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  return {
    phase,
    frame: lastFrame,
    error: lastError,
    start,
    sendAction,
    stop,
    download,
  };
}
