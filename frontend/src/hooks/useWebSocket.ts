import { useCallback, useEffect, useRef, useState } from "react";
import type { FrameMessage } from "../types";

export type WsStatus = "connecting" | "open" | "closed" | "error";

export interface UseWebSocketReturn {
  send: (msg: object) => void;
  lastFrame: FrameMessage | null;
  status: WsStatus;
  close: () => void;
}

export function useWebSocket(url: string | null): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastFrame, setLastFrame] = useState<FrameMessage | null>(null);
  const [status, setStatus] = useState<WsStatus>("closed");

  useEffect(() => {
    if (!url) return;

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");

    ws.onmessage = (evt: MessageEvent) => {
      try {
        const frame = JSON.parse(evt.data as string) as FrameMessage;
        setLastFrame(frame);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("closed");

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

  return { send, lastFrame, status, close };
}
