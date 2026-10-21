import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { useTranslations } from "next-intl";
import { useRef, useState, useEffect } from "react";
import { useDevice } from "@/hooks/useDevice";

export default function SyncButton({
  syncFunc,
  hasNew,
}: {
  syncFunc: () => Promise<void>;
  hasNew?: boolean;
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
        className="btn btn-outline btn-primary col-span-9 md:col-span-2 h-full min-h-16 md:min-h-0 rounded-box bg-base-100 content-center"
        title={hasNew ? t("hasNewContent") : undefined}
        onClick={onClick}
      >
        <span className="flex items-center gap-2 whitespace-nowrap">
          <CursorArrowRippleIcon className="h-6 w-6" />
          <span className="relative inline-block">
            {t("syncButtonText")}
            {hasNew && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-1.5 h-1.5 w-1.5 rounded-full bg-success ring-1 ring-base-100"
              />
            )}
          </span>
        </span>
        <span className="sr-only" aria-live="polite">
          {hasNew ? t("hasNewContent") : ""}
        </span>
      </button>
    </>
  );
}
