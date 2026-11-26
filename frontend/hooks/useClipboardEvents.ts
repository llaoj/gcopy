"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardType } from "@/lib/clipboard";
import { loadClipboardCursor } from "@/lib/clipboard-cursor";

export interface ClipboardEvent {
  index: number;
  type?: ClipboardType;
  clientName?: string;
}

// Listen to `/api/v1/clipboard/events` (SSE) while the tab is visible; close
// the stream when hidden so background tabs hold zero server connections.
export default function useClipboardEvents({
  userId,
  enabled,
  paused,
}: {
  userId?: string;
  enabled: boolean;
  paused: boolean;
}) {
  const [hasNew, setHasNew] = useState(false);
  const [latestEvent, setLatestEvent] = useState<ClipboardEvent | null>(null);
  const latestIndexRef = useRef<number>(0);

  const recomputeHasNew = useCallback(
    (remoteIndex: number) => {
      if (!userId) {
        setHasNew(false);
        return;
      }
      setHasNew(
        remoteIndex > 0 && remoteIndex !== loadClipboardCursor(userId).index,
      );
    },
    [userId],
  );

  const applyEvent = useCallback(
    (event: ClipboardEvent) => {
      if (typeof event.index !== "number") {
        return;
      }
      latestIndexRef.current = event.index;
      setLatestEvent((prev) =>
        prev &&
        prev.index === event.index &&
        prev.type === event.type &&
        prev.clientName === event.clientName
          ? prev
          : event,
      );
      recomputeHasNew(event.index);
    },
    [recomputeHasNew],
  );

  // Re-evaluate `hasNew` immediately when a local sync finishes (`paused`
  // flips back to false after updating localStorage) or when another tab
  // updates localStorage.
  useEffect(() => {
    if (!paused) {
      recomputeHasNew(latestIndexRef.current);
    }
  }, [paused, recomputeHasNew]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const onStorage = () => recomputeHasNew(latestIndexRef.current);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId, recomputeHasNew]);

  useEffect(() => {
    if (
      !enabled ||
      paused ||
      !userId ||
      typeof window === "undefined" ||
      typeof window.EventSource === "undefined"
    ) {
      return;
    }

    let eventSource: EventSource | null = null;

    function close() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    }

    function connect() {
      if (document.visibilityState !== "visible" || eventSource) {
        return;
      }
      const stream = new EventSource("/api/v1/clipboard/events", {
        withCredentials: true,
      });
      eventSource = stream;

      stream.onmessage = (message) => {
        try {
          applyEvent(JSON.parse(message.data) as ClipboardEvent);
        } catch {
          // Ignore malformed event payloads.
        }
      };

      stream.onerror = () => {
        // When the server rejects with non-200 (e.g. 401/429), browsers mark
        // readyState CLOSED; clear the reference so `online`/`pageshow` can
        // reconnect cleanly later. For transient network drops, readyState is
        // CONNECTING and EventSource reconnects automatically on its own.
        if (stream.readyState === EventSource.CLOSED) {
          eventSource = null;
        }
      };
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        connect();
      } else {
        close();
      }
    }

    function onReconnectTrigger() {
      if (document.visibilityState === "visible") {
        connect();
      }
    }

    connect();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onReconnectTrigger);
    window.addEventListener("pageshow", onReconnectTrigger);

    return () => {
      close();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onReconnectTrigger);
      window.removeEventListener("pageshow", onReconnectTrigger);
    };
  }, [enabled, paused, userId, applyEvent]);

  return { hasNew, latestEvent };
}
