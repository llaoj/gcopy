import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { useTranslations } from "next-intl";
import { useRef, useState, useEffect } from "react";
import { useDevice } from "@/hooks/useDevice";

export default function SyncButton({
  syncFunc,
  lastSource,
}: {
  syncFunc: () => Promise<void>;
  lastSource: string | null;
}) {
  const [clicked, setClicked] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("SyncClipboard");
  const { isDesktop, isMacOs } = useDevice();

  const onClick = async () => {
    setClicked(true);
    await syncFunc();
    setClicked(false);
  };

  // shortcut
  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    function keyDownHandler(e: globalThis.KeyboardEvent) {
      // refer: https://support.google.com/chrome/answer/157179
      if (
        (!e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey &&
          e.key === "Enter") ||
        (isMacOs && e.metaKey && e.key == "1") ||
        (!isMacOs && e.ctrlKey && e.key == "1")
      ) {
        e.preventDefault();
        buttonRef.current?.click();
      }
    }
    document.addEventListener("keydown", keyDownHandler);
    return () => document.removeEventListener("keydown", keyDownHandler);
  }, [isDesktop, isMacOs]);

  return (
    <>
      <button
        ref={buttonRef}
        disabled={clicked}
        className="btn btn-outline btn-primary col-span-9 md:col-span-2 h-full rounded-box bg-base-100 content-center"
        onClick={onClick}
      >
        <span className="flex flex-col items-center gap-1 w-full min-w-0">
          <span className="flex items-center gap-2 whitespace-nowrap">
            <CursorArrowRippleIcon className="h-6 w-6" />
            {t("syncButtonText")}
          </span>
          {lastSource && (
            <span
              className="flex flex-col items-center w-full min-w-0 text-[10px] font-normal opacity-60 leading-tight"
              title={`${t("fromSource")} ${lastSource}`}
            >
              <span>{t("fromSource")}</span>
              <span className="w-full truncate">{lastSource}</span>
            </span>
          )}
        </span>
      </button>
    </>
  );
}
