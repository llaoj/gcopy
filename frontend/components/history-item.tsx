import { useLocale, useTranslations } from "next-intl";
import {
  EllipsisHorizontalIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HistoryItemEntity } from "@/models/history";
import moment from "moment/min/moment-with-locales";
import { db } from "@/models/db";
import { Log, LogLevel } from "@/lib/log";
import { clipboardWriteBlob, clipboardWriteBlobPromise } from "@/lib/clipboard";
import { browserName } from "react-device-detect";
import { FileInfo } from "@/lib/clipboard";

export default function HistoryItem({
  item,
  addLog,
  updateFileLink,
}: {
  item: HistoryItemEntity;
  addLog: (log: Log) => void;
  updateFileLink: (fileInfo: FileInfo) => void;
}) {
  const t = useTranslations("SyncClipboard");
  const locale = useLocale();
  moment.locale(locale == "zh" ? "zh-cn" : "en");
  const ulRef = useRef<HTMLUListElement>(null);

  const [text, setText] = useState<string>("");
  useEffect(() => {
    setText("");
    if (item.type == "text") {
      const parseText = async () => {
        setText(await item.data.text());
      };
      parseText();
    }
  }, [item]);

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
        {item.type == "text" && (
          <p className="line-clamp-1 opacity-70 break-all">{text}</p>
        )}
        {item.type == "screenshot" && (
          <div className="relative h-full">
            <Image
              className="object-left object-contain"
              src={(window.URL || window.webkitURL).createObjectURL(item.data)}
              alt="user's screenshot"
              fill
            />
          </div>
        )}
        {item.type == "file" && (
          <p className="line-clamp-1 opacity-70 break-all">
            {"[" + t("file") + "]" + item.fileName}
          </p>
        )}
      </td>
      <td className="w-min p-2 text-xs text-nowrap break-keep opacity-50 text-right">
        {moment(item.createdAt).fromNow()}
      </td>
      <td className="w-min p-2">
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-xs">
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-[1] w-28 p-2 shadow"
            ref={ulRef}
          >
            <li>
              <a
                onClick={async () => {
                  ulRef.current && ulRef.current.blur();
                  if (item.type == "file") {
                    updateFileLink({
                      fileName: item.fileName ?? "",
                      fileURL: (window.URL || window.webkitURL).createObjectURL(
                        item.data,
                      ),
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
                }}
              >
                {t("history.use")}
              </a>
            </li>
            {item.pin == "true" && (
              <li>
                <a
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
                  onClick={async () => {
                    ulRef.current && ulRef.current.blur();
                    const count = await db.history
                      .where("pin")
                      .equals("true")
                      .count();
                    if (count >= 10) {
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
