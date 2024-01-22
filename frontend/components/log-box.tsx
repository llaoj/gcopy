import { Log } from "@/lib/types";

export default function LogBox({ logs }: { logs: Log[] }) {
  const listItems = logs.map((log, index) => (
    <pre data-prefix=">" key={index} className={`${log.level}`}>
      <code>{log.message}</code>
    </pre>
  ));

  return (
    <div className="mockup-code h-52 col-span-9 md:col-span-7 text-sm">
      {listItems}
    </div>
  );
}
