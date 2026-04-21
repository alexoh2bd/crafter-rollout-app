// Cursor (AI-assisted).

import { useCallback, useEffect, useRef, useState } from "react";
import type { FrameMessage } from "../types";

export type WsStatus = "connecting" | "open" | "closed" | "error";

export interface UseWebSocketReturn {
  send: (msg: object) => void;
  lastFrame: FrameMessage | null;
  lastError: string | null;
  status: WsStatus;
  close: () => void;
}

export function useWebSocket(url: string | null): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastFrame, setLastFrame] = useState<FrameMessage | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [status, setStatus] = useState<WsStatus>("closed");

  useEffect(() => {
    if (!url) return;

    setStatus("connecting");
    setLastError(null);
    setLastFrame(null);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");

    ws.onmessage = (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(evt.data as string) as Record<string, unknown>;
        if (typeof parsed.error === "string") {
          setLastError(parsed.error);
          return;
        }
        setLastFrame(parsed as unknown as FrameMessage);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = (evt: CloseEvent) => {
      if (evt.code === 4004) {
        setLastError((prev) =>
          prev ??
          "Session expired or invalid (e.g. page remounted). Press Start again.",
        );
      }
      setStatus("closed");
    };

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [url]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const close = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { send, lastFrame, lastError, status, close };
}
