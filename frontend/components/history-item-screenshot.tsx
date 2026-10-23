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
    <span className="flex h-full w-full items-center">
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="block h-8 w-fit max-w-full"
      >
        <Image
          src={blobUrl}
          alt="history item screenshot"
          width={0}
          height={0}
          sizes="100vw"
          className="h-8 w-auto max-w-full object-contain object-left"
        />
      </a>
    </span>
  );
}
