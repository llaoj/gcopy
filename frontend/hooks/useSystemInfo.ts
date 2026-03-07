import { useState, useEffect } from "react";
import { getSystemInfo, SystemInfo } from "@/lib/system-info";

export default function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSystemInfo() {
      setIsLoading(true);
      const info = await getSystemInfo();
      setSystemInfo(info);
      setIsLoading(false);
    }
    fetchSystemInfo();
  }, []);

  return { systemInfo, isLoading, authMode: systemInfo?.authMode ?? null };
}
