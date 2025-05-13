import { useEffect, useState } from "react";
import { HistoryItemEntity } from "@/models/history";
import { isValidURL } from "@/lib/clipboard";

export default function HistoryItemText({ item }: { item: HistoryItemEntity }) {
  if (item.type !== "text" || !item.dataArrayBuffer) return null;

  const [text, setText] = useState<string>("");
  useEffect(() => {
    const parseText = async () => {
      if (item.dataArrayBuffer) {
        setText(
          await new Blob([item.dataArrayBuffer], {
            type: item.dataType,
          }).text(),
        );
      }
    };
    parseText();
  }, [item.dataArrayBuffer, item.dataType]);

  if (!text) return null;

  return isValidURL(text) ? (
    <a
      href={text}
      target="_blank"
      rel="noopener noreferrer"
      className="line-clamp-1 opacity-70 break-all hover:underline"
    >
      {text}
    </a>
  ) : (
    <p className="line-clamp-1 opacity-70 break-all">{text}</p>
  );
}
