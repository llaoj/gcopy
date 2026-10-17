import { RefObject } from "react";
import { useTranslations } from "next-intl";
import { useDevice } from "@/hooks/useDevice";

export default function QuickInput({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
}) {
  const t = useTranslations("SyncClipboard");
  const { isDesktop } = useDevice();

  return (
    <div className="pb-4 flex flex-col gap-2">
      <div className="text-sm select-none opacity-70">
        <span className="font-bold">{t("quickInput.title")}</span>
        <span>{" " + t("quickInput.subTitle")}</span>
        {isDesktop && (
          <span className="ml-1 text-xs opacity-50">
            {t("quickInput.newline") + ": Shift+Enter"}
          </span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="textarea textarea-bordered block rounded-box resize-y leading-tight w-full min-h-12 p-2"
      ></textarea>
    </div>
  );
}
