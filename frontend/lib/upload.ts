const UPLOAD_IDLE_TIMEOUT_MS = 30_000;
const UPLOAD_MAX_RETRIES = 2;

export type UploadErrorKind = "network" | "timeout";

export class UploadError extends Error {
  readonly kind: UploadErrorKind;

  constructor(kind: UploadErrorKind) {
    super(kind);
    this.name = "UploadError";
    this.kind = kind;
  }
}

export interface UploadResponse {
  status: number;
  headers: Headers;
  body: string;
}

interface UploadOptions {
  url: string;
  blob: Blob;
  headers: Record<string, string>;
  onProgress?: (progress: number) => void;
  onRetry?: () => void;
}

function uploadWithProgress({
  url,
  blob,
  headers,
  onProgress,
}: Omit<UploadOptions, "onRetry">): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearWatchdog = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const fail = (kind: UploadErrorKind) => {
      if (settled) {
        return;
      }
      settled = true;
      clearWatchdog();
      reject(new UploadError(kind));
    };

    const armWatchdog = () => {
      clearWatchdog();
      timeoutId = setTimeout(() => {
        fail("timeout");
        xhr.abort();
      }, UPLOAD_IDLE_TIMEOUT_MS);
    };

    xhr.upload.onprogress = (event) => {
      if (settled) {
        return;
      }
      armWatchdog();
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (settled) {
        return;
      }

      if (xhr.status === 0) {
        fail("network");
        return;
      }

      settled = true;
      clearWatchdog();

      const responseHeaders = new Headers();
      xhr
        .getAllResponseHeaders()
        .split("\r\n")
        .forEach((line) => {
          const separator = line.indexOf(":");
          if (separator <= 0) {
            return;
          }
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim();
          if (key && value) {
            responseHeaders.set(key, value);
          }
        });

      resolve({
        status: xhr.status,
        headers: responseHeaders,
        body: xhr.responseText,
      });
    };

    xhr.onerror = () => fail("network");
    xhr.onabort = () => fail("network");

    armWatchdog();
    try {
      xhr.send(blob);
    } catch {
      fail("network");
    }
  });
}

function shouldRetry(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

export async function uploadBlobWithRetry({
  url,
  blob,
  headers,
  onProgress,
  onRetry,
}: UploadOptions): Promise<UploadResponse> {
  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      onRetry?.();
      onProgress?.(0);
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * 2 ** (attempt - 1)),
      );
    }

    try {
      const response = await uploadWithProgress({
        url,
        blob,
        headers,
        onProgress,
      });

      if (shouldRetry(response.status) && attempt < UPLOAD_MAX_RETRIES) {
        continue;
      }

      return response;
    } catch (err) {
      if (err instanceof UploadError && attempt < UPLOAD_MAX_RETRIES) {
        continue;
      }
      throw err;
    }
  }

  throw new UploadError("network");
}
