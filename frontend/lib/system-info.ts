export interface SystemInfo {
  time: string;
  maxContentLength: number; // unit: MiB
  authMode: string; // "email" or "token"
}

let systemInfo: SystemInfo | null = null;

export async function getSystemInfo(): Promise<SystemInfo | null> {
  if (systemInfo) {
    return systemInfo;
  }

  try {
    const response = await fetch("/api/v1/systeminfo");
    if (response.ok) {
      systemInfo = await response.json();
      return systemInfo;
    }
  } catch (error) {
    console.error("Failed to get system info:", error);
  }

  return null;
}
