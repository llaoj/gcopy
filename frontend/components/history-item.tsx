import { useTranslations } from "next-intl";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/solid";
import HistoryItemScreenshot from "@/components/history-item-screenshot";
import HistoryItemText from "@/components/history-item-text";
import { useRef, useCallback, memo } from "react";
import { HistoryItemEntity } from "@/models/history";
import moment from "moment";
import { db } from "@/models/db";
import { Log, LogLevel } from "@/lib/log";
import { clipboardWriteBlob, clipboardWriteBlobPromise } from "@/lib/clipboard";
import { downloadBlob } from "@/lib/file-utils";
import { browserName } from "react-device-detect";

// 自定义比较函数：只有核心字段变化时才重新渲染
function arePropsEqual(
  prevProps: { item: HistoryItemEntity; isNew?: boolean },
  nextProps: { item: HistoryItemEntity; isNew?: boolean },
) {
  return (
    prevProps.isNew === nextProps.isNew &&
    prevProps.item.createdAt === nextProps.item.createdAt &&
    prevProps.item.pin === nextProps.item.pin &&
    prevProps.item.index === nextProps.item.index &&
    prevProps.item.blobId === nextProps.item.blobId &&
    prevProps.item.type === nextProps.item.type &&
    prevProps.item.fileName === nextProps.item.fileName
  );
}

// 使用 React.memo 包裹组件，配合自定义比较函数实现局部刷新
const HistoryItem = memo(function HistoryItem({
  item,
  addLog,
  isNew,
}: {
  item: HistoryItemEntity;
  addLog: (log: Log) => void;
  isNew?: boolean;
}) {
  const t = useTranslations("SyncClipboard");
  const ulRef = useRef<HTMLUListElement>(null);

  // 使用 useCallback 缓存事件处理函数
  const handleUse = useCallback(async () => {
    try {
      ulRef.current?.blur();

      if (item.type == "file") {
        // iOS Safari: 强制使用 application/octet-stream 避免 Safari 渲染 PDF 等文件
        const blob = item.dataArrayBuffer
          ? new Blob([item.dataArrayBuffer], {
              type: "application/octet-stream",
            })
          : item.data;
        downloadBlob(blob, item.fileName ?? "file");
        addLog({
          message: t("logs.autoDownload"),
          level: LogLevel.Success,
        });
        return;
      }

      if (item.type == "text" || item.type == "screenshot") {
        const blob = item.dataArrayBuffer
          ? new Blob([item.dataArrayBuffer], { type: item.dataType })
          : item.data;

        if (browserName.includes("Safari")) {
          await clipboardWriteBlobPromise(blob);
          addLog({
            message: t("logs.writeSuccess"),
            level: LogLevel.Success,
          });
          return;
        }

        await clipboardWriteBlob(blob);
        addLog({
          message: t("logs.writeSuccess"),
          level: LogLevel.Success,
        });
      }
    } catch (err) {
      addLog({ message: String(err), level: LogLevel.Error });
    }
  }, [
    item.type,
    item.dataArrayBuffer,
    item.dataType,
    item.data,
    item.fileName,
    addLog,
    t,
  ]);

  const handlePin = useCallback(async () => {
    const count = await db.history.where("pin").equals("true").count();
    if (count >= 10) {
      ulRef.current?.blur();
      addLog({
        message: t("logs.pinLimit"),
        level: LogLevel.Warn,
      });
      return;
    }
    await db.history.update(item.createdAt!, { pin: "true" });
  }, [item.createdAt, addLog, t]);

  const handleUnpin = useCallback(async () => {
    await db.history.update(item.createdAt!, { pin: "false" });
  }, [item.createdAt]);

  const handleDelete = useCallback(async () => {
    await db.history.delete(item.createdAt!);
    ulRef.current?.blur();
  }, [item.createdAt]);

  return (
    <div
      data-key={item.createdAt}
      className={`flex items-center gap-2 h-14 px-2 text-sm${
        isNew ? " history-enter-f" : ""
      }`}
    >
      <div className="w-4 shrink-0 text-center text-sm opacity-50">
        {item.pin == "true" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 mx-auto rotate-45"
          >
            <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
          </svg>
        ) : (
          <span>{item.index}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 h-full flex items-center px-2">
        {item.type == "text" && (
          <div className="w-full min-w-0">
            <HistoryItemText item={item} />
          </div>
        )}
        {item.type == "screenshot" && <HistoryItemScreenshot item={item} />}
        {item.type == "file" && (
          <a
            onClick={handleUse}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-w-0 line-clamp-1 opacity-70 break-all cursor-pointer hover:underline"
          >
            {"[" + t("file") + "]" + decodeURI(item.fileName ?? "")}
          </a>
        )}
      </div>
      <div className="shrink-0 whitespace-pre text-xs text-nowrap opacity-50 text-right">
        {moment(item.createdAt).fromNow()}
      </div>
      <div className="w-9 shrink-0 flex justify-center">
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-xs">
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-[1] w-28 p-2 shadow-lg border border-base-300"
            ref={ulRef}
          >
            <li>
              <a className="hover:bg-base-300 opacity-70" onClick={handleUse}>
                {t("history.use")}
              </a>
            </li>
            {item.pin == "true" && (
              <li>
                <a
                  className="hover:bg-base-300 opacity-70"
                  onClick={handleUnpin}
                >
                  Unpin
                </a>
              </li>
            )}
            {item.pin == "false" && (
              <li>
                <a className="hover:bg-base-300 opacity-70" onClick={handlePin}>
                  Pin
                </a>
              </li>
            )}
            <li>
              <a
                className="hover:bg-base-300 opacity-70"
                onClick={handleDelete}
              >
                {t("history.delete")}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}, arePropsEqual);

export default HistoryItem;
