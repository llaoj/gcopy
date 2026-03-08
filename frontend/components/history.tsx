import { useTranslations } from "next-intl";
import HistoryItem from "./history-item";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/models/db";
import { Log } from "@/lib/log";
import { FileInfo } from "@/lib/clipboard";
import { useCallback } from "react";

export default function History({
  addLog,
  updateFileLink,
}: {
  addLog: (log: Log) => void;
  updateFileLink: (fileInfo: FileInfo) => void;
}) {
  const t = useTranslations("SyncClipboard.history");

  // 分离查询：pinned 和 unpinned items，减少不必要的重新渲染
  const pinnedItems = useLiveQuery(
    () => db.history.where("pin").equals("true").reverse().toArray(),
    [],
  );

  const recentItems = useLiveQuery(
    () => db.history.where("pin").equals("false").reverse().limit(20).toArray(),
    [],
  );

  // 使用 useCallback 稳定回调函数引用，避免每次渲染创建新函数
  const stableAddLog = useCallback((log: Log) => addLog(log), [addLog]);
  const stableUpdateFileLink = useCallback(
    (fileInfo: FileInfo) => updateFileLink(fileInfo),
    [updateFileLink],
  );

  if (!pinnedItems || !recentItems) return null;

  return (
    <div className="pb-4">
      <div className="pb-2 text-base font-bold">{t("title")}</div>
      <div className="pb-2 text-sm opacity-70">{t("subTitle")}</div>
      <div className="bg-base-100 rounded-box mb-2 px-2 border border-base-300">
        <table className="table">
          <tbody>
            {pinnedItems.length === 0 && recentItems.length === 0 && (
              <tr>
                <td className="w-4 p-2 opacity-50 text-center">{t("empty")}</td>
              </tr>
            )}
            {pinnedItems.map((item) => (
              <HistoryItem
                key={item.createdAt}
                item={item}
                addLog={stableAddLog}
                updateFileLink={stableUpdateFileLink}
              />
            ))}
            {recentItems.map((item) => (
              <HistoryItem
                key={item.createdAt}
                item={item}
                addLog={stableAddLog}
                updateFileLink={stableUpdateFileLink}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
