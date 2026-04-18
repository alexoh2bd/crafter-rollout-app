import { useCallback, useEffect, useRef, useState } from "react";
import type { FrameMessage, SessionMode } from "../types";
import {
  closeSession,
  createSession,
  downloadRollout,
  WS_URL,
} from "../lib/api";
import { useWebSocket } from "./useWebSocket";

export type SessionPhase = "idle" | "connecting" | "playing" | "done";

export interface StartOpts {
  checkpointId?: string;
  fps?: number;
}

export interface UseGameSessionReturn {
  phase: SessionPhase;
  frame: FrameMessage | null;
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

  const { send, lastFrame, status } = useWebSocket(wsUrl);

  // Transition from "connecting" → "playing" once WS opens, send agent init msg
  useEffect(() => {
    if (status === "open" && phase === "connecting") {
      if (mode === "agent" && !initSentRef.current) {
        initSentRef.current = true;
        send({
          checkpoint_id: optsRef.current.checkpointId ?? "random",
          fps: optsRef.current.fps ?? 4,
        });
      }
      setPhase("playing");
    }
    if (status === "closed" && phase === "playing") {
      setPhase("done");
    }
    if (status === "error") {
      setPhase("idle");
    }
  }, [status, phase, mode, send]);

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
      if (phase !== "idle" && phase !== "done") return;
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

  return { phase, frame: lastFrame, start, sendAction, stop, download };
}
