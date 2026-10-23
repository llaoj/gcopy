import { DragEvent, useRef, useState } from "react";
import { DocumentIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useDevice } from "@/hooks/useDevice";

export default function SyncFile({
  fileName,
  uploading,
  onFileChange,
}: {
  fileName: string;
  uploading: boolean;
  onFileChange: (file: File) => Promise<void>;
}) {
  const t = useTranslations("SyncClipboard");
  const { isMobile } = useDevice();
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
          "preview flex-1 min-h-24 md:min-h-40 border rounded-box flex flex-col items-center justify-center gap-y-1 px-4",
          uploading ? "cursor-progress" : "cursor-pointer",
          { "border-primary text-primary": dragging },
          { "border-base-300": !dragging },
        )}
        aria-busy={uploading}
        onDragOver={(ev: DragEvent<HTMLElement>) => {
          ev.preventDefault();
        }}
        onDragEnter={() => {
          if (!uploading) {
            setDragging(true);
          }
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={async (ev: DragEvent<HTMLElement>) => {
          ev.preventDefault();
          setDragging(false);
          if (uploading) {
            return;
          }
          const droppedFile = ev.dataTransfer?.files?.[0];
          if (droppedFile) {
            await onFileChange(droppedFile);
          }
        }}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!uploading) {
            fileInputRef.current?.click();
          }
        }}
        onKeyDown={(ev) => {
          if (!uploading && (ev.key === "Enter" || ev.key === " ")) {
            ev.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        {!dragging && (
          <>
            <p className="w-full truncate text-center">
              {uploading ? (
                t("syncFile.uploading")
              ) : fileName ? (
                fileName
              ) : (
                <DocumentIcon
                  className="mx-auto h-5 w-5 opacity-40"
                  aria-hidden="true"
                />
              )}
            </p>
            <div className="text-sm opacity-40">
              {isMobile
                ? t("syncFile.selectFileTip")
                : t("syncFile.dragDropTip")}
            </div>
          </>
        )}
      </div>
      <input
        type="file"
        hidden
        ref={fileInputRef}
        disabled={uploading}
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
