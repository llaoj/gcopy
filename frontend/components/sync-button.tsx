import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useRef, useState, useEffect } from "react";
import { useDevice } from "@/hooks/useDevice";
import type { PendingPrompt } from "@/lib/sync-prompt";

export default function SyncButton({
  syncFunc,
  hasNew,
  prompt,
  onCancelPrompt,
}: {
  syncFunc: () => Promise<void>;
  hasNew?: boolean;
  prompt?: PendingPrompt | null;
  onCancelPrompt?: () => void;
}) {
  const [clicked, setClicked] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("SyncClipboard");
  const { isDesktop, isMacOs } = useDevice();

  const label =
    prompt === "paste"
      ? t("prompt.syncButtonCancelWaiting")
      : prompt
        ? t("prompt.syncButtonPressAgain")
        : t("syncButtonText");
  const onClick = async () => {
    if (prompt === "paste") {
      onCancelPrompt?.();
      return;
    }

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
      if (prompt && e.key === "Escape") {
        e.preventDefault();
        onCancelPrompt?.();
        return;
      }

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
  }, [isDesktop, isMacOs, prompt, onCancelPrompt]);

  return (
    <>
      <button
        ref={buttonRef}
        disabled={clicked}
        className={clsx(
          "btn col-span-9 md:col-span-2 h-full min-h-16 md:min-h-0 rounded-box content-center",
          prompt
            ? "btn-warning ring-2 ring-warning ring-offset-2 ring-offset-base-100"
            : "btn-outline btn-primary bg-base-100",
        )}
        title={label}
        onClick={onClick}
      >
        <span className="flex items-center gap-2 whitespace-nowrap">
          <CursorArrowRippleIcon className="h-6 w-6" />
          <span className="relative inline-block">
            {label}
            {hasNew && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-1.5 h-1.5 w-1.5 rounded-full bg-success ring-1 ring-base-100"
              />
            )}
          </span>
        </span>
      </button>
    </>
  );
}
