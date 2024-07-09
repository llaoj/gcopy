import { useTranslations } from "next-intl";
import HistoryItem from "./history-item";

export default function History() {
  const t = useTranslations("SyncClipboard.history");

  return (
    <div className="pb-4">
      <div className="pb-2 text-base font-bold">{t("title")}</div>
      <div className="pb-2 text-sm opacity-70">{t("subTitle")}</div>
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
