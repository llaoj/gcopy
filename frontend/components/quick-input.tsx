import { useTranslations } from "next-intl";
import { useDevice } from "@/hooks/useDevice";

export default function QuickInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("SyncClipboard");
  const { isDesktop } = useDevice();

  return (
    <div className="pb-4 flex flex-col h-full">
      <div className="pb-2 text-sm opacity-70">
        <span className="font-bold">{t("quickInput.title")}</span>
        <span>{" " + t("quickInput.subTitle")}</span>
        {isDesktop && (
          <span className="ml-1 text-xs opacity-50">
            {t("quickInput.newline") + ": Shift+Enter"}
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="textarea textarea-bordered block rounded-box leading-tight w-full min-h-12 p-2 flex-1"
      ></textarea>
    </div>
  );
}
