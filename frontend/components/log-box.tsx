import { Log, Level } from "@/lib/log";

export default function LogBox({ logs }: { logs: Log[] }) {
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
        level = "";
        break;
    }
    return (
      <pre data-prefix=">" key={index} className={level}>
        <code>{log.message}</code>
      </pre>
    );
  });

  return (
    <div className="mockup-code min-h-52 col-span-9 md:col-span-7 text-sm">
      {listItems}
    </div>
  );
}
