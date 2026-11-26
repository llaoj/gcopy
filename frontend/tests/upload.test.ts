import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { UploadError, uploadBlobWithRetry } from "../lib/upload";

type MockBehavior =
  | {
      kind: "respond";
      status: number;
      headers?: string;
      body?: string;
      progressEvents?: Array<{ loaded: number; total: number }>;
    }
  | { kind: "error" }
  | { kind: "stall" };

describe("uploadBlobWithRetry", () => {
  const originalXHR = (globalThis as { XMLHttpRequest?: unknown })
    .XMLHttpRequest;

  afterEach(() => {
    if (originalXHR === undefined) {
      delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    } else {
      (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = originalXHR;
    }
  });

  function installMockXHR(script: MockBehavior[]) {
    let callIndex = 0;
    const sentRequests: Array<{
      method: string;
      url: string;
      headers: Record<string, string>;
      aborted: boolean;
    }> = [];

    class FakeXHR {
      status = 0;
      responseText = "";
      private rawHeaders = "";
      private record = {
        method: "",
        url: "",
        headers: {} as Record<string, string>,
        aborted: false,
      };

      upload: {
        onprogress:
          | ((event: {
              lengthComputable: boolean;
              loaded: number;
              total: number;
            }) => void)
          | null;
      } = { onprogress: null };

      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      open(method: string, url: string) {
        this.record.method = method;
        this.record.url = url;
      }

      setRequestHeader(key: string, value: string) {
        this.record.headers[key] = value;
      }

      getAllResponseHeaders() {
        return this.rawHeaders;
      }

      abort() {
        this.record.aborted = true;
        this.onabort?.();
      }

      send(_body: Blob) {
        sentRequests.push(this.record);
        const step = script[Math.min(callIndex, script.length - 1)];
        callIndex += 1;

        queueMicrotask(() => {
          if (step.kind === "stall") {
            return;
          }
          if (step.kind === "error") {
            this.onerror?.();
            return;
          }
          for (const progress of step.progressEvents ?? []) {
            this.upload.onprogress?.({
              lengthComputable: true,
              loaded: progress.loaded,
              total: progress.total,
            });
          }
          this.status = step.status;
          this.rawHeaders = step.headers ?? "";
          this.responseText = step.body ?? "";
          this.onload?.();
        });
      }
    }

    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeXHR;
    return sentRequests;
  }

  it("uploads successfully, forwards headers, parses response headers, and tracks progress", async () => {
    const requests = installMockXHR([
      {
        kind: "respond",
        status: 200,
        headers: "X-Index: 4\r\nContent-Type: application/json\r\n",
        body: '{"message":"Success"}',
        progressEvents: [
          { loaded: 50, total: 100 },
          { loaded: 100, total: 100 },
        ],
      },
    ]);

    const seenProgress: number[] = [];
    const response = await uploadBlobWithRetry({
      url: "/api/v1/clipboard",
      blob: new Blob(["hello"], { type: "text/plain" }),
      headers: { "X-Type": "text" },
      onProgress: (pct) => seenProgress.push(pct),
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers["X-Type"], "text");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-index"), "4");
    assert.deepEqual(seenProgress, [50, 100]);
  });

  it("retries transient 5xx and network failures and succeeds when backend recovers", async () => {
    const requests = installMockXHR([
      { kind: "error" },
      { kind: "respond", status: 502, body: "Bad Gateway" },
      {
        kind: "respond",
        status: 200,
        headers: "X-Index: 9\r\n",
        body: '{"message":"Success"}',
      },
    ]);

    let retries = 0;
    const response = await uploadBlobWithRetry({
      url: "/api/v1/clipboard",
      blob: new Blob(["retry-me"]),
      headers: { "X-Type": "text" },
      retryBaseDelayMs: 1,
      onRetry: () => {
        retries += 1;
      },
    });

    assert.equal(requests.length, 3);
    assert.equal(retries, 2);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-index"), "9");
  });

  it("does not retry non-retryable 4xx responses such as 401 or 413", async () => {
    const requests = installMockXHR([
      { kind: "respond", status: 401, body: '{"message":"Unauthorized"}' },
    ]);

    const response = await uploadBlobWithRetry({
      url: "/api/v1/clipboard",
      blob: new Blob(["x"]),
      headers: { "X-Type": "text" },
      retryBaseDelayMs: 1,
    });

    assert.equal(requests.length, 1);
    assert.equal(response.status, 401);
  });

  it("aborts stalled uploads and throws UploadError('timeout') after exhausting retries", async () => {
    const requests = installMockXHR([{ kind: "stall" }]);

    await assert.rejects(
      uploadBlobWithRetry({
        url: "/api/v1/clipboard",
        blob: new Blob(["stalled"]),
        headers: { "X-Type": "file" },
        idleTimeoutMs: 10,
        retryBaseDelayMs: 1,
      }),
      (err: unknown) => err instanceof UploadError && err.kind === "timeout",
    );

    assert.equal(requests.length, 3);
    assert.equal(
      requests.every((req) => req.aborted),
      true,
    );
  });
});
