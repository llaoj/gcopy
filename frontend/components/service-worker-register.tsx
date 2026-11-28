"use client";

import { useEffect } from "react";
import { SERVICE_WORKER_PATH, shouldRegisterServiceWorker } from "@/lib/pwa";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !shouldRegisterServiceWorker(
        process.env.NODE_ENV,
        "serviceWorker" in navigator,
      )
    ) {
      return;
    }

    navigator.serviceWorker
      .register(SERVICE_WORKER_PATH, { scope: "/" })
      .catch((error) => {
        console.warn("Service worker registration skipped:", error);
      });
  }, []);

  return null;
}
