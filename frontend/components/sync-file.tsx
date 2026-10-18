import { DragEvent, useRef, useState } from "react";
import clsx from "clsx";
import { useTranslations } from "next-intl";

export default function SyncFile({
  fileName,
  onFileChange,
}: {
  fileName: string;
  onFileChange: (file: File) => Promise<void>;
}) {
  const t = useTranslations("SyncClipboard");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pb-4 flex flex-col">
      <div className="pb-2 text-sm opacity-70">
        <span className="font-bold">{t("syncFile.title")}</span>
        <span>{" " + t("syncFile.subTitle")}</span>
      </div>
      <div
        className={clsx(
          "preview flex-1 min-h-24 md:min-h-40 border rounded-box flex flex-col items-center justify-center gap-y-1 px-4 cursor-pointer",
          { "border-primary text-primary": dragging },
          { "border-base-300": !dragging },
        )}
        onDragOver={(ev: DragEvent<HTMLElement>) => {
          ev.preventDefault();
        }}
        onDragEnter={() => {
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={async (ev: DragEvent<HTMLElement>) => {
          ev.preventDefault();
          const droppedFile = ev.dataTransfer?.files?.[0];
          setDragging(false);
          if (droppedFile) {
            await onFileChange(droppedFile);
          }
        }}
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        {!dragging && (
          <>
            {fileName && (
              <p className="w-full truncate text-center">{fileName}</p>
            )}
            <div className="text-sm opacity-40">
              {t("syncFile.dragDropTip")}
            </div>
          </>
        )}
      </div>
      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={async () => {
          const selectedFile = fileInputRef.current?.files?.[0];
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          if (selectedFile) {
            await onFileChange(selectedFile);
          }
        }}
      />
    </div>
  );
}
