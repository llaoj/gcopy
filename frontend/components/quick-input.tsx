import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { useState, RefObject } from "react";
import { useTranslations } from "next-intl";

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
        <div className="flex justify-between items-center text-sm opacity-70 peer-checked/showTextarea:pb-2 cursor-pointer">
          <span>
            <span className="font-bold">{t("quickInput.title")}:</span>
            {" " + t("quickInput.subTitle")}
          </span>
          <span className="ml-1">
            {!checked && <ChevronDownIcon className="h-4 w-4" />}
            {checked && <ChevronUpIcon className="h-4 w-4" />}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          className="textarea block w-full min-h-0 h-0  p-0 border-none peer-checked/showTextarea:border-solid peer-checked/showTextarea:textarea-bordered peer-checked/showTextarea:min-h-28 peer-checked/showTextarea:p-1 transition-all duration-400"
        ></textarea>
      </label>
    </div>
  );
}
