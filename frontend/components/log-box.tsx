import { Log, LogLevel } from "@/lib/log";
import type { SyncDirection } from "@/lib/log";
import { useRef, useEffect, useState } from "react";

// 红绿灯最短显示时长：同步期间持续闪烁，结束后至少再保留一段时间，
// 避免快速操作一闪而过。
const LIGHT_SHOW_MS = 1500;

export default function LogBox({
  logs,
  direction,
}: {
  logs: Log[];
  direction: SyncDirection;
}) {
  const ulRef = useRef<HTMLUListElement>(null);
  // 实际驱动红绿灯动画的方向：同步期间保持显示，结束后至少再保留
  // LIGHT_SHOW_MS，避免快速操作一闪而过。
  const [shownDir, setShownDir] = useState<SyncDirection>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number>(0);
  const hasShownRef = useRef<boolean>(false);

  useEffect(() => {
    if (direction != null) {
      startedAtRef.current = Date.now();
      hasShownRef.current = true;
      setShownDir(direction);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!hasShownRef.current) {
      return;
    }

    const remaining = Math.max(
      0,
      LIGHT_SHOW_MS - (Date.now() - startedAtRef.current),
    );
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setShownDir(null), remaining);
  }, [direction]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (ulRef.current) {
      ulRef.current.scrollTop = ulRef.current.scrollHeight;
    }
  }, [logs]);

  const listItems = logs.map((log, index) => {
    let level;
    switch (log.level) {
      case LogLevel.Warn:
        level = "text-warning font-medium";
        break;
      case LogLevel.Success:
        level = "text-green-600";
        break;
      case LogLevel.Error:
        level = "text-rose-600 font-medium";
        break;
      default:
        level = "text-white";
        break;
    }
    return (
      <li key={index} className={level}>
        {log.message}
      </li>
    );
  });

  return (
    <div
      className="logbox bg-neutral rounded-box h-52 col-span-9 md:col-span-7 flex flex-col  overflow-hidden py-2 text-white text-sm"
      data-dir={shownDir ?? undefined}
    >
      <div className="traffic">
        <span className="dot dot-red" />
        <span className="dot dot-yellow" />
        <span className="dot dot-green" />
      </div>
      <ul
        ref={ulRef}
        role="log"
        aria-live="polite"
        className="overflow-auto flex-auto"
      >
        {listItems}
      </ul>
    </div>
  );
}
