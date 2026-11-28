import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";
import {
  isBypassedByServiceWorker,
  SERVICE_WORKER_PATH,
  shouldRegisterServiceWorker,
} from "../lib/pwa";

const frontendRoot = path.resolve(__dirname, "../..");
const publicDir = path.join(frontendRoot, "public");

describe("PWA manifest, icons, and registration policy", () => {
  it("only registers the service worker in production when supported", () => {
    assert.equal(shouldRegisterServiceWorker("production", true), true);
    assert.equal(shouldRegisterServiceWorker("production", false), false);
    assert.equal(shouldRegisterServiceWorker("development", true), false);
    assert.equal(shouldRegisterServiceWorker("test", true), false);
    assert.equal(shouldRegisterServiceWorker(undefined, true), false);
  });

  it("bypasses API, SSE, ping, sw.js, and non-GET requests", () => {
    assert.equal(isBypassedByServiceWorker("POST", "/api/v1/clipboard"), true);
    assert.equal(
      isBypassedByServiceWorker("GET", "/api/v1/clipboard/events"),
      true,
    );
    assert.equal(isBypassedByServiceWorker("GET", "/api/v1/user"), true);
    assert.equal(isBypassedByServiceWorker("GET", "/ping"), true);
    assert.equal(isBypassedByServiceWorker("GET", SERVICE_WORKER_PATH), true);
    assert.equal(isBypassedByServiceWorker("GET", "/"), false);
    assert.equal(
      isBypassedByServiceWorker("GET", "/_next/static/chunks/main.js"),
      false,
    );
  });

  it("ships valid manifest.json and preserves original favicon.ico & gcopy.svg", () => {
    assert.equal(
      fs.existsSync(path.join(frontendRoot, "app", "favicon.ico")),
      true,
    );
    assert.equal(fs.existsSync(path.join(publicDir, "gcopy.svg")), true);
    assert.equal(
      fs.existsSync(path.join(publicDir, "apple-touch-icon.png")),
      true,
    );

    const manifestRaw = fs.readFileSync(
      path.join(publicDir, "manifest.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      name: string;
      display: string;
      start_url: string;
      scope: string;
      icons: Array<{
        src: string;
        sizes: string;
        type: string;
        purpose: string;
      }>;
    };

    assert.equal(manifest.name, "GCopy");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.ok(manifest.icons.length >= 3);

    for (const icon of manifest.icons) {
      const iconPath = path.join(publicDir, icon.src.replace(/^\//, ""));
      assert.equal(fs.existsSync(iconPath), true, `missing icon ${icon.src}`);
      assert.ok(fs.statSync(iconPath).size > 0, `empty icon ${icon.src}`);
    }
  });

  it("service worker never intercepts /api/* or SSE and caches static shell offline", async () => {
    const swSource = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");

    const listeners = new Map<string, (event: unknown) => void>();
    const cacheBuckets = new Map<string, Map<string, Response>>();
    let skipWaitingCalled = false;
    let clientsClaimCalled = false;
    let networkOnline = true;

    const fakeCaches = {
      async open(name: string) {
        let bucket = cacheBuckets.get(name);
        if (!bucket) {
          bucket = new Map();
          cacheBuckets.set(name, bucket);
        }
        return {
          async addAll(urls: string[]) {
            for (const url of urls) {
              bucket!.set(
                `https://gcopy.link${url}`,
                new Response(`precached:${url}`, { status: 200 }),
              );
            }
          },
          async match(req: Request | string) {
            const key =
              typeof req === "string" ? `https://gcopy.link${req}` : req.url;
            return bucket!.get(key)?.clone();
          },
          async put(req: Request, res: Response) {
            bucket!.set(req.url, res.clone());
          },
        };
      },
      async keys() {
        return Array.from(cacheBuckets.keys());
      },
      async delete(name: string) {
        return cacheBuckets.delete(name);
      },
      async match(req: Request | string) {
        const key =
          typeof req === "string" ? `https://gcopy.link${req}` : req.url;
        for (const bucket of Array.from(cacheBuckets.values())) {
          const hit = bucket.get(key);
          if (hit) {
            return hit.clone();
          }
        }
        return undefined;
      },
    };

    cacheBuckets.set("gcopy-shell-stale", new Map());

    const sandbox = {
      URL,
      Response,
      caches: fakeCaches,
      fetch: async (req: Request) => {
        if (!networkOnline) {
          throw new Error("offline");
        }
        return new Response(`live:${new URL(req.url).pathname}`, {
          status: 200,
        });
      },
      self: {
        location: { origin: "https://gcopy.link" },
        skipWaiting: async () => {
          skipWaitingCalled = true;
        },
        clients: {
          claim: async () => {
            clientsClaimCalled = true;
          },
        },
        addEventListener: (type: string, handler: (event: unknown) => void) => {
          listeners.set(type, handler);
        },
      },
    };

    vm.runInNewContext(swSource, sandbox);

    // 1. Install precaches shell assets and calls skipWaiting().
    let installPromise: Promise<unknown> = Promise.resolve();
    listeners.get("install")?.({
      waitUntil: (p: Promise<unknown>) => {
        installPromise = p;
      },
    });
    await installPromise;
    assert.equal(skipWaitingCalled, true);

    // 2. Activate purges stale caches and claims clients.
    let activatePromise: Promise<unknown> = Promise.resolve();
    listeners.get("activate")?.({
      waitUntil: (p: Promise<unknown>) => {
        activatePromise = p;
      },
    });
    await activatePromise;
    assert.equal(clientsClaimCalled, true);
    assert.equal(cacheBuckets.has("gcopy-shell-stale"), false);
    assert.equal(cacheBuckets.has("gcopy-shell-v1"), true);

    // Helper to dispatch a fetch event to sw.js.
    const dispatchFetch = (
      url: string,
      options: { method?: string; mode?: string } = {},
    ): Promise<Response> | null => {
      let responded: Promise<Response> | null = null;
      listeners.get("fetch")?.({
        request: {
          url,
          method: options.method ?? "GET",
          mode: options.mode ?? "cors",
        },
        respondWith: (p: Promise<Response>) => {
          responded = p;
        },
      });
      return responded;
    };

    // 3. Privacy & SSE check: /api/*, /ping, /sw.js, and POST are NEVER intercepted.
    assert.equal(
      dispatchFetch("https://gcopy.link/api/v1/clipboard/events"),
      null,
    );
    assert.equal(dispatchFetch("https://gcopy.link/api/v1/clipboard"), null);
    assert.equal(
      dispatchFetch("https://gcopy.link/api/v1/clipboard", { method: "POST" }),
      null,
    );
    assert.equal(dispatchFetch("https://gcopy.link/ping"), null);
    assert.equal(dispatchFetch("https://gcopy.link/sw.js"), null);

    // 4. Navigation caches shell when online and falls back cleanly when offline.
    const onlineNav = await dispatchFetch("https://gcopy.link/", {
      mode: "navigate",
    });
    assert.ok(onlineNav);
    assert.equal(await onlineNav.text(), "live:/");

    networkOnline = false;
    const offlineNav = await dispatchFetch("https://gcopy.link/", {
      mode: "navigate",
    });
    assert.ok(offlineNav);
    assert.equal(await offlineNav.text(), "live:/");
  });
});
