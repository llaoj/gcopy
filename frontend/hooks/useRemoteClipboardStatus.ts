"use client";

import { useCallback, useEffect, useState } from "react";
import { loadClipboardState } from "@/lib/clipboard-state";

export interface RemoteClipboardStatus {
  index: number;
  type?: string;
  clientName?: string;
}

// Poll every 10s while the tab is visible; pause entirely while it is hidden
// (browsers throttle or suspend timers in background tabs anyway). Focus and
// visibility events trigger an immediate check when the user comes back.
const POLL_INTERVAL_MS = 10_000;
const JITTER_MS = 2_000;
const REQUEST_TIMEOUT_MS = 5_000;
// Collapse duplicate triggers (focus + visibilitychange, pageshow, ...).
const DEDUPE_MS = 1_000;

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

  const check = useCallback(async () => {
    if (!userId) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/v1/clipboard/status", {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      // 401 is handled by the auth flow; 404 means the server is an older
      // version without this endpoint. Neither should surface as an error.
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as RemoteClipboardStatus;
      if (typeof data.index !== "number") {
        return;
      }

      setRemoteStatus((prev) =>
        prev &&
        prev.index === data.index &&
        prev.type === data.type &&
        prev.clientName === data.clientName
          ? prev
          : data,
      );
      // Match the app's index-based sync semantics: any different non-zero
      // index means there is content to fetch. The local index lives in the
      // shared localStorage state (see lib/clipboard-state).
      setHasNew(data.index > 0 && data.index !== loadClipboardState(userId).ci);
    } catch {
      // Network errors and timeouts are ignored; the next tick retries.
    } finally {
      clearTimeout(timeout);
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled || paused || !userId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastCheckAt = 0;
    let inFlight = false;

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function schedule() {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      clearTimer();
      timer = setTimeout(
        () => void run(),
        POLL_INTERVAL_MS + Math.random() * JITTER_MS,
      );
    }

    async function run() {
      if (cancelled || document.visibilityState !== "visible" || inFlight) {
        return;
      }

      clearTimer();

      const now = Date.now();
      if (now - lastCheckAt < DEDUPE_MS) {
        schedule();
        return;
      }
      lastCheckAt = now;

      inFlight = true;
      try {
        await check();
      } finally {
        inFlight = false;
        schedule();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void run();
      } else {
        clearTimer();
      }
    }

    function onFocus() {
      void run();
    }

    function onPageShow() {
      void run();
    }

    function onOnline() {
      void run();
    }

    void run();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, paused, userId, check]);

  return { hasNew, remoteStatus };
}
