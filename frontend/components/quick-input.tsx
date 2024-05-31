import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { useState, RefObject } from "react";
import { useTranslations } from "next-intl";
import { isDesktop } from "react-device-detect";

export default function QuickInput({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
}) {
  const [checked, setChecked] = useState<boolean>(false);
  const t = useTranslations("SyncClipboard");

  const onChange = async () => {
    setChecked((current) => !current);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      !checked && textareaRef.current.focus();
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
              <span className="ml-1 text-xs opacity-50">
                {t("quickInput.newline") + ": Shift+Enter"}
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
          className="textarea block rounded-box resize-none leading-tight w-full min-h-0 h-0  p-0 border-none peer-checked/showTextarea:border-solid peer-checked/showTextarea:textarea-bordered peer-checked/showTextarea:min-h-20 peer-checked/showTextarea:p-2 transition-all duration-400"
        ></textarea>
      </label>
    </div>
  );
}
