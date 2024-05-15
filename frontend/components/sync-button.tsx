import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { useTranslations } from "next-intl";
import { useRef, useState, useEffect } from "react";

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

  useEffect(() => {
    function keyDownHandler(e: globalThis.KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        buttonRef.current?.click();
      }
    }
    document.addEventListener("keydown", keyDownHandler);
    return () => document.removeEventListener("keydown", keyDownHandler);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        disabled={clicked}
        className="btn btn-outline btn-primary col-span-9 md:col-span-2 h-full rounded-box bg-base-100 content-center"
        onClick={onClick}
      >
        <CursorArrowRippleIcon className="h-6 w-6" />
        {t("click2sync")}
      </button>
    </>
  );
}
