import { useMemo } from "react";
import Image from "next/image";
import { HistoryItemEntity } from "@/models/history";

export default function HistoryItemScreenshot({
  item,
}: {
  item: HistoryItemEntity;
}) {
  if (item.type !== "screenshot" || !item.dataArrayBuffer) return null;

  const blobUrl = useMemo(() => {
    if (!item.dataArrayBuffer) return "";
    return (window.URL || window.webkitURL).createObjectURL(
      new Blob([item.dataArrayBuffer], { type: item.dataType }),
    );
  }, [item.dataArrayBuffer, item.dataType]);

  if (!blobUrl) return null;

  return (
    <a href={blobUrl} target="_blank" rel="noopener noreferrer">
      <div className="relative h-full">
        <Image
          src={blobUrl}
          alt="history item screenshot"
          className="object-left object-contain"
          fill
        />
      </div>
    </a>
  );
}
