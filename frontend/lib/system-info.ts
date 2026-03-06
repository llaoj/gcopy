export interface SystemInfo {
  time: string;
  maxContentLength: number; // unit: MiB
  authMode: string; // "email" or "token"
}

let systemInfoPromise: Promise<SystemInfo | null> | null = null;

export async function getSystemInfo(): Promise<SystemInfo | null> {
  if (systemInfoPromise) {
    return systemInfoPromise;
  }

  systemInfoPromise = fetch("/api/v1/systeminfo")
    .then((response) => {
      if (response.ok) {
        return response.json() as Promise<SystemInfo>;
      }
      return null;
    })
    .catch((error) => {
      console.error("Failed to get system info:", error);
      // Reset so next call retries
      systemInfoPromise = null;
      return null;
    });

  return systemInfoPromise;
}
