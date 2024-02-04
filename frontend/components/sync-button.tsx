import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import useWindowFocus from "@/lib/window-focus";

export default function SyncButton({
  syncFunc,
  canAutoClickFunc,
}: {
  syncFunc: () => void;
  canAutoClickFunc: () => boolean;
}) {
  const [clicked, setClicked] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("SyncClipboard");
  const windowFocused = useWindowFocus();

  useEffect(() => {
    if (windowFocused && canAutoClickFunc()) {
      buttonRef.current?.click();
    }
  }, [windowFocused]);

  const onClick = () => {
    setClicked(true);
    syncFunc();
    setClicked(false);
  };

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
