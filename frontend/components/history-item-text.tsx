import { useEffect, useState } from "react";
import { HistoryItemEntity } from "@/models/history";
import { isValidURL } from "@/lib/clipboard";

export default function HistoryItemText({ item }: { item: HistoryItemEntity }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    const parseText = async () => {
      if (item.type == "text" && item.dataArrayBuffer) {
        setText(
          await new Blob([item.dataArrayBuffer], {
            type: item.dataType,
          }).text(),
        );
      }
    };
    parseText();
  }, [item]);

  if (!text) return null;

  return isValidURL(text) ? (
    <span className="line-clamp-1 opacity-70 break-all">
      <a
        href={text}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hover:underline"
      >
        {text}
      </a>
    </span>
  ) : (
    <span className="line-clamp-1 opacity-70 break-all">{text}</span>
  );
}
