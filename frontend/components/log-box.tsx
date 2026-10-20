import { Log, LogLevel } from "@/lib/log";
import type { SyncDirection } from "@/lib/log";
import { useRef, useEffect, useState } from "react";

// 红绿灯动画固定显示时长：方向确定后保持这段时间，
// 让一次呼吸动画（约 1.5s）能完整播放完，避免一闪而过。
const LIGHT_SHOW_MS = 1500;

export default function LogBox({
  logs,
  direction,
}: {
  logs: Log[];
  direction: SyncDirection;
}) {
  const ulRef = useRef<HTMLUListElement>(null);
  // 实际驱动红绿灯动画的方向：direction 变回 null 后仍保持 LIGHT_SHOW_MS，
  // 保证呼吸动画能被完整看到。
  const [shownDir, setShownDir] = useState<SyncDirection>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (direction == null) {
      return;
    }

    setShownDir(direction);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setShownDir(null), LIGHT_SHOW_MS);
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
        level = "text-warning";
        break;
      case LogLevel.Success:
        level = "text-green-600";
        break;
      case LogLevel.Error:
        level = "text-rose-600";
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
      <ul ref={ulRef} className="overflow-auto flex-auto">
        {listItems}
      </ul>
    </div>
  );
}
