import { Log, LogLevel } from "@/lib/log";
import { useRef, useEffect, useState } from "react";

// 红绿灯动画最短显示时长，避免快速同步一闪而过
const MIN_SYNC_MS = 1200;

export default function LogBox({
  logs,
  syncing,
}: {
  logs: Log[];
  syncing: boolean;
}) {
  const ulRef = useRef<HTMLUListElement>(null);
  // 实际驱动红绿灯动画的状态：即便 syncing 很快变回 false，
  // 也至少保持 MIN_SYNC_MS，保证动画能被看到。
  const [active, setActive] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (syncing) {
      startedAtRef.current = Date.now();
      setActive(true);
      return;
    }

    const remain = MIN_SYNC_MS - (Date.now() - startedAtRef.current);
    if (remain <= 0) {
      setActive(false);
      return;
    }

    const timer = setTimeout(() => setActive(false), remain);
    return () => clearTimeout(timer);
  }, [syncing]);

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
      data-syncing={active}
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
