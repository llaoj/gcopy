import { useTranslations } from "next-intl";
import {
  EllipsisHorizontalIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import HistoryItemScreenshot from "@/components/history-item-screenshot";
import HistoryItemText from "@/components/history-item-text";
import { useRef, useMemo, useCallback, memo } from "react";
import { HistoryItemEntity } from "@/models/history";
import moment from "moment";
import "moment/locale/zh-cn";
import { db } from "@/models/db";
import { Log, LogLevel } from "@/lib/log";
import {
  clipboardWriteBlob,
  clipboardWriteBlobPromise,
  FileInfo,
} from "@/lib/clipboard";
import { browserName } from "react-device-detect";
import { useLocale } from "next-intl";

// 自定义比较函数：只有核心字段变化时才重新渲染
function arePropsEqual(
  prevProps: { item: HistoryItemEntity },
  nextProps: { item: HistoryItemEntity },
) {
  return (
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
  updateFileLink,
}: {
  item: HistoryItemEntity;
  addLog: (log: Log) => void;
  updateFileLink: (fileInfo: FileInfo) => void;
}) {
  const locale = useLocale();
  moment.locale(locale == "zh" ? "zh-cn" : "en");

  const t = useTranslations("SyncClipboard");
  const ulRef = useRef<HTMLUListElement>(null);

  // 使用 useMemo 缓存 blob URL
  const blobFileURL = useMemo(() => {
    if (item.type !== "file") return "";
    // iOS Safari: 使用 ArrayBuffer 创建 Blob，其他浏览器直接使用 data
    const blob = item.dataArrayBuffer
      ? new Blob([item.dataArrayBuffer], { type: item.dataType })
      : item.data;
    // 确保 blob 存在才创建 URL
    if (!blob) return "";
    return (window.URL || window.webkitURL).createObjectURL(blob);
  }, [item.type, item.data, item.dataArrayBuffer, item.dataType]);

  // 使用 useCallback 缓存事件处理函数
  const handleUse = useCallback(async () => {
    try {
      ulRef.current?.blur();

      if (item.type == "file") {
        updateFileLink({
          fileName: item.fileName ?? "",
          fileURL: blobFileURL,
        });
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
    blobFileURL,
    addLog,
    updateFileLink,
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
    <tr>
      <td className="w-4 p-2 opacity-50">
        {item.pin == "true" ? (
          <LockClosedIcon className="w-4 h-4" />
        ) : (
          <span className="text-sm">{item.index}</span>
        )}
      </td>
      <td className="h-14 p-2 w-auto">
        {item.type == "text" && <HistoryItemText item={item} />}
        {item.type == "screenshot" && <HistoryItemScreenshot item={item} />}
        {item.type == "file" && (
          <a
            onClick={handleUse}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-1 opacity-70 break-all cursor-pointer hover:underline"
          >
            {"[" + t("file") + "]" + decodeURI(item.fileName ?? "")}
          </a>
        )}
      </td>
      <td className="w-min pr-1 whitespace-pre p-2 text-xs text-nowrap break-keep opacity-50 text-right">
        {moment(item.createdAt).fromNow()}
      </td>
      <td className="w-9 px-0">
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
      </td>
    </tr>
  );
}, arePropsEqual);

export default HistoryItem;
