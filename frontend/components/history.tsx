import { useTranslations } from "next-intl";
import HistoryItem from "./history-item";

export default function History() {
  const t = useTranslations("SyncClipboard");

  return (
    <div className="pb-4">
      <div className="flex justify-between items-center text-sm select-none opacity-70 pb-2">
        <div>
          <span className="font-bold">{t("history.title")}:</span>
          <span>{" " + t("history.subTitle")}</span>
        </div>
      </div>
      <div className="bg-base-100 rounded-box border mb-2 px-2">
        <table className="table">
          <tbody>
            <HistoryItem />
            <HistoryItem />
            <HistoryItem />
          </tbody>
        </table>
      </div>
    </div>
  );
}
