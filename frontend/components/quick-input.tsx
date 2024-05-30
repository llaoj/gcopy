import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { useEffect, useState, RefObject } from "react";
import { useTranslations } from "next-intl";
import { isDesktop, isMacOs } from "react-device-detect";

export default function QuickInput({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
}) {
  const [checked, setChecked] = useState<boolean>(false);
  const t = useTranslations("SyncClipboard");

  // shortcut
  useEffect(() => {
    function keyDownHandler(e: globalThis.KeyboardEvent) {
      if (!isDesktop) {
        return;
      }
      if (e.altKey && e.key === "Enter" && textareaRef.current) {
        e.preventDefault();
        textareaRef.current.value += "\r\n";
      }
    }
    document.addEventListener("keydown", keyDownHandler);
    return () => document.removeEventListener("keydown", keyDownHandler);
  });

  const onChange = async () => {
    setChecked((current) => !current);
    if (textareaRef.current) {
      textareaRef.current.value = "";
    }
  };

  return (
    <div className="pb-4">
      <label>
        <input
          className="peer/showTextarea absolute scale-0"
          type="checkbox"
          onChange={onChange}
        />
        <div className="flex justify-between items-center text-sm select-none opacity-70 peer-checked/showTextarea:pb-2 cursor-pointer">
          <div>
            <span className="font-bold">{t("quickInput.title")}:</span>
            <span>{" " + t("quickInput.subTitle")}</span>
            {isDesktop && (
              <span className="ml-1 text-xs opacity-50 inline-block align-bottom">
                {t("quickInput.newline")}: Alt+Enter
              </span>
            )}
          </div>
          <div className="ml-1 flex items-center">
            {!checked && <ChevronDownIcon className="h-4 w-4" />}
            {checked && <ChevronUpIcon className="h-4 w-4" />}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="textarea block resize-none leading-tight w-full min-h-0 h-0  p-0 border-none peer-checked/showTextarea:border-solid peer-checked/showTextarea:textarea-bordered peer-checked/showTextarea:min-h-28 peer-checked/showTextarea:p-1 transition-all duration-400"
        ></textarea>
      </label>
    </div>
  );
}
