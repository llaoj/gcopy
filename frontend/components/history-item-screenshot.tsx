import { useMemo } from "react";
import Image from "next/image";
import { HistoryItemEntity } from "@/models/history";

export default function HistoryItemScreenshot({
  item,
}: {
  item: HistoryItemEntity;
}) {
  const blobUrl = useMemo(() => {
    if (item.type !== "screenshot" || !item.dataArrayBuffer) return "";
    return (window.URL || window.webkitURL).createObjectURL(
      new Blob([item.dataArrayBuffer], { type: item.dataType }),
    );
  }, [item.type, item.dataArrayBuffer, item.dataType]);

  if (!blobUrl) return null;

  return (
    <div className="flex h-full w-full items-center">
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-8 w-full"
      >
        <Image
          src={blobUrl}
          alt="history item screenshot"
          className="object-left object-contain"
          fill
        />
      </a>
    </div>
  );
}
