import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useShortcut } from "@/lib/shortcut";

export default function SyncButton({
  syncFunc,
}: {
  syncFunc: () => Promise<void>;
}) {
  const [clicked, setClicked] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("SyncClipboard");

  const onClick = async () => {
    setClicked(true);
    await syncFunc();
    setClicked(false);
  };

  useShortcut({
    key: "Enter",
    onKeyPressed: () => {
      buttonRef.current?.click();
    },
  });

  return (
    <>
      <button
        ref={buttonRef}
        disabled={clicked}
        className="btn btn-outline btn-primary col-span-9 md:col-span-2 h-full rounded-box bg-base-100 content-center"
        onClick={onClick}
      >
        <CursorArrowRippleIcon className="h-6 w-6" />
        &#47;
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 -960 960 960"
          stroke="currentColor"
          fill="currentColor"
          className="h-6 w-6"
        >
          <path d="M360-240 120-480l240-240 56 56-144 144h488v-160h80v240H272l144 144-56 56Z" />
        </svg>
        {t("syncButtonText")}
      </button>
    </>
  );
}
