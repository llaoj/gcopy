"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadClipboardState } from "@/lib/clipboard-state";

export interface RemoteClipboardStatus {
  index: number;
  type?: string;
  clientName?: string;
}

// Listen to `/api/v1/clipboard/events` (SSE) while the tab is visible; close
// the stream when hidden so background tabs hold zero server connections.
export default function useRemoteClipboardStatus({
  userId,
  enabled,
  paused,
}: {
  userId?: string;
  enabled: boolean;
  paused: boolean;
}) {
  const [hasNew, setHasNew] = useState(false);
  const [remoteStatus, setRemoteStatus] =
    useState<RemoteClipboardStatus | null>(null);
  const latestIndexRef = useRef<number>(0);

  const recomputeHasNew = useCallback(
    (remoteIndex: number) => {
      if (!userId) {
        setHasNew(false);
        return;
      }
      setHasNew(
        remoteIndex > 0 && remoteIndex !== loadClipboardState(userId).ci,
      );
    },
    [userId],
  );

  const applyStatus = useCallback(
    (data: RemoteClipboardStatus) => {
      if (typeof data.index !== "number") {
        return;
      }
      latestIndexRef.current = data.index;
      setRemoteStatus((prev) =>
        prev &&
        prev.index === data.index &&
        prev.type === data.type &&
        prev.clientName === data.clientName
          ? prev
          : data,
      );
      recomputeHasNew(data.index);
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
      const es = new EventSource("/api/v1/clipboard/events", {
        withCredentials: true,
      });
      eventSource = es;

      es.onmessage = (ev) => {
        try {
          applyStatus(JSON.parse(ev.data) as RemoteClipboardStatus);
        } catch {
          // Ignore malformed event payloads.
        }
      };

      es.onerror = () => {
        // When the server rejects with non-200 (e.g. 401/429), browsers mark
        // readyState CLOSED; clear the reference so `online`/`pageshow` can
        // reconnect cleanly later. For transient network drops, readyState is
        // CONNECTING and EventSource reconnects automatically on its own.
        if (es.readyState === EventSource.CLOSED) {
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
  }, [enabled, paused, userId, applyStatus]);

  return { hasNew, remoteStatus };
}
