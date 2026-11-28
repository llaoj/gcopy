export const SERVICE_WORKER_PATH = "/sw.js";

// Only register the Service Worker in production builds so `next dev`
// hot-reloading on localhost is never cached by a stale worker.
export function shouldRegisterServiceWorker(
  nodeEnv: string | undefined,
  hasServiceWorkerSupport: boolean,
): boolean {
  return nodeEnv === "production" && hasServiceWorkerSupport;
}

export function isBypassedByServiceWorker(
  method: string,
  pathname: string,
): boolean {
  if (method.toUpperCase() !== "GET") {
    return true;
  }
  return (
    pathname.startsWith("/api/") ||
    pathname === "/ping" ||
    pathname === SERVICE_WORKER_PATH
  );
}
