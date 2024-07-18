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

export default function HistoryItem({ item }: { item: HistoryItemEntity }) {
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
            {"[" + t("file") + "]" + item.filename}
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
            className="dropdown-content menu bg-base-100 rounded-box z-[1] w-fit p-2 shadow"
            ref={ulRef}
          >
            <li>
              <a>{t("history.use")}</a>
            </li>
            {item.pin == "true" && (
              <li>
                <a>Unpin</a>
              </li>
            )}
            {item.pin == "false" && (
              <li>
                <a>Pin</a>
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
