import { Log, Level } from "@/lib/log";
import { useRef, useEffect } from "react";

export default function LogBox({ logs }: { logs: Log[] }) {
  const ulRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (ulRef.current) {
      ulRef.current.scrollTop = ulRef.current.scrollHeight;
    }
  }, [logs]);

  const listItems = logs.map((log, index) => {
    let level;
    switch (log.level) {
      case Level.Warn:
        level = "text-warning";
        break;
      case Level.Success:
        level = "text-green-600";
        break;
      case Level.Error:
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
    <div className="logbox bg-neutral rounded-box h-52 col-span-9 md:col-span-7 flex flex-col  overflow-hidden py-2 text-white text-sm">
      <ul ref={ulRef} className="overflow-auto flex-auto">
        {listItems}
      </ul>
    </div>
  );
}
