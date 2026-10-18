import { useTranslations } from "next-intl";
import HistoryItem from "./history-item";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/models/db";
import { Log } from "@/lib/log";
import { useCallback } from "react";

export default function History({ addLog }: { addLog: (log: Log) => void }) {
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

  if (!pinnedItems || !recentItems) return null;

  return (
    <div className="pb-4">
      <div className="pb-2 text-base font-bold">{t("title")}</div>
      <div className="pb-2 text-sm opacity-70">{t("subTitle")}</div>
      <div className="bg-base-100 rounded-box mb-2 border border-base-300 divide-y divide-base-300">
        {pinnedItems.length === 0 && recentItems.length === 0 && (
          <div className="px-2 py-2 text-sm opacity-50 text-center">
            {t("empty")}
          </div>
        )}
        {pinnedItems.map((item) => (
          <HistoryItem key={item.createdAt} item={item} addLog={stableAddLog} />
        ))}
        {recentItems.map((item) => (
          <HistoryItem key={item.createdAt} item={item} addLog={stableAddLog} />
        ))}
      </div>
    </div>
  );
}
