import { useTranslations } from "next-intl";
import HistoryItem from "./history-item";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/models/db";
import { Log } from "@/lib/log";
import { FileInfo } from "@/lib/clipboard";

export default function History({
  addLog,
  updateFileLink,
}: {
  addLog: (log: Log) => void;
  updateFileLink: (fileInfo: FileInfo) => void;
}) {
  const t = useTranslations("SyncClipboard.history");
  const items = useLiveQuery(() => db.history.reverse().toArray());
  if (!items) return null;

  return (
    <div className="pb-4">
      <div className="pb-2 text-base font-bold">{t("title")}</div>
      <div className="pb-2 text-sm opacity-70">{t("subTitle")}</div>
      <div className="bg-base-100 rounded-box border mb-2 px-2">
        <table className="table">
          <tbody>
            {items.map(
              (item) =>
                item.pin == "true" && (
                  <HistoryItem
                    item={item}
                    addLog={addLog}
                    updateFileLink={updateFileLink}
                  />
                ),
            )}
            {items.map(
              (item) =>
                item.pin == "false" && (
                  <HistoryItem
                    item={item}
                    addLog={addLog}
                    updateFileLink={updateFileLink}
                  />
                ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
