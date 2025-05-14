import { useTranslations } from "next-intl";
import {
  EllipsisHorizontalIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import HistoryItemScreenshot from "@/components/history-item-screenshot";
import HistoryItemText from "@/components/history-item-text";
import { useRef, useMemo } from "react";
import { HistoryItemEntity } from "@/models/history";
import moment from "moment";
import "moment/locale/zh-cn";
import { db } from "@/models/db";
import { Log, LogLevel } from "@/lib/log";
import { clipboardWriteBlob, clipboardWriteBlobPromise } from "@/lib/clipboard";
import { browserName } from "react-device-detect";
import { FileInfo } from "@/lib/clipboard";
import { useLocale } from "next-intl";

export default function HistoryItem({
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

  const blobFileURL = useMemo(() => {
    if (item.type !== "file") return "";
    return (window.URL || window.webkitURL).createObjectURL(item.data);
  }, [item.type, item.data]);

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
            onClick={() => {
              updateFileLink({
                fileName: item.fileName ?? "",
                fileURL: blobFileURL,
              });
              addLog({
                message: t("logs.autoDownload"),
                level: LogLevel.Success,
              });
            }}
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
              <a
                className="hover:bg-base-300 opacity-70"
                onClick={async () => {
                  try {
                    ulRef.current && ulRef.current.blur();
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
                      if (browserName.includes("Safari")) {
                        await clipboardWriteBlobPromise(item.data);
                        addLog({
                          message: t("logs.writeSuccess"),
                          level: LogLevel.Success,
                        });
                        return;
                      }

                      await clipboardWriteBlob(item.data);
                      addLog({
                        message: t("logs.writeSuccess"),
                        level: LogLevel.Success,
                      });
                      return;
                    }
                  } catch (err) {
                    addLog({ message: String(err), level: LogLevel.Error });
                  }
                }}
              >
                {t("history.use")}
              </a>
            </li>
            {item.pin == "true" && (
              <li>
                <a
                  className="hover:bg-base-300 opacity-70"
                  onClick={() => {
                    db.history.update(item, { pin: "false" });
                  }}
                >
                  Unpin
                </a>
              </li>
            )}
            {item.pin == "false" && (
              <li>
                <a
                  className="hover:bg-base-300 opacity-70"
                  onClick={async () => {
                    const count = await db.history
                      .where("pin")
                      .equals("true")
                      .count();
                    if (count >= 10) {
                      ulRef.current && ulRef.current.blur();
                      addLog({
                        message: t("logs.pinLimit"),
                        level: LogLevel.Warn,
                      });
                      return;
                    }
                    db.history.update(item, { pin: "true" });
                  }}
                >
                  Pin
                </a>
              </li>
            )}
            <li>
              <a
                className="hover:bg-base-300 opacity-70"
                onClick={() => {
                  item.createdAt && db.history.delete(item.createdAt);
                  ulRef.current && ulRef.current.blur();
                }}
              >
                {t("history.delete")}
              </a>
            </li>
          </ul>
        </div>
      </td>
    </tr>
  );
}
