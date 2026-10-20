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
          <span className="ml-3 inline-flex items-center gap-1 align-middle text-xs opacity-50">
            <span>{t("quickInput.newline")}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              fill="currentColor"
              className="inline h-3 w-3"
            >
              <path d="M320-120v-310H120l360-450 360 450H640v310H320Zm60-60h200v-310h133L480-786 247-490h133v310Zm100-310Z" />
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              fill="currentColor"
              className="inline h-3 w-3"
            >
              <path d="M360-240 120-480l240-240 56 56-144 144h488v-160h80v240H272l144 144-56 56Z" />
            </svg>
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="textarea textarea-bordered block rounded-box leading-tight w-full min-h-12 p-2 flex-1 text-base"
      ></textarea>
    </div>
  );
}
