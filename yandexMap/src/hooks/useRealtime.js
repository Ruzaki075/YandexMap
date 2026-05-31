import { useEffect, useRef } from "react";
import { WS_URL } from "../config.js";
import { getToken } from "../services/api.js";

/**
 * WebSocket: marker_created, marker_updated, notification, moderation_presence
 */
export function useRealtime({ onMarkerCreated, onMarkerUpdated, onNotification, onModerationPresence, enabled = true }) {
  const handlers = useRef({ onMarkerCreated, onMarkerUpdated, onNotification, onModerationPresence });
  handlers.current = { onMarkerCreated, onMarkerUpdated, onNotification, onModerationPresence };

  useEffect(() => {
    if (!enabled) return undefined;
    const token = getToken();
    if (!token) return undefined;

    let ws;
    let closed = false;
    let retryMs = 2000;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const h = handlers.current;
          switch (msg.type) {
            case "marker_created":
              h.onMarkerCreated?.(msg.payload);
              break;
            case "marker_updated":
              h.onMarkerUpdated?.(msg.payload);
              break;
            case "notification":
              h.onNotification?.(msg.payload);
              break;
            case "moderation_presence":
              h.onModerationPresence?.(msg.payload);
              break;
            default:
              break;
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 1.5, 30000);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* */
        }
      };
    };

    connect();
    return () => {
      closed = true;
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [enabled]);
}
