import { useTranslations } from "next-intl";
import { ChevronDownIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import Image from "next/image";

export default function HistoryItem() {
  const t = useTranslations("SyncClipboard");

  return (
    <tr>
      <td className="w-4 p-2 opacity-50">
        {/* <span className="text-sm">1</span> */}
        <LockClosedIcon className="w-4 h-4" />
      </td>
      <td className="p-2">
        <p className="line-clamp-1 opacity-70">
          Cy GandertonCy GandertonCy GandertonCy GandertonCy GandertonCy
          GandertonCy GandertonCy GandertonCy GandertonCy GandertonCy
          GandertonCy GandertonCy GandertonCy GandertonCy GandertonCy
          GandertonCy Ganderton
        </p>
        {/* <div className="h-9 relative">
          <Image
            className="object-left object-contain"
            src="/WechatIMG54720.jpeg"
            // src="/LWScreenShot 2024-02-24 at 17.10.59.png"
            // src="/WX20240705-140031.png"
            // src="/WX20240705-140216.png"
            alt="user's screenshot"
            fill
          />
        </div> */}
      </td>
      <td className="w-min p-2 text-xs text-nowrap opacity-50">2月前</td>
      <td className="w-min p-2">
        <div className="flex flex-row flex-nowrap">
          <button className="btn btn-sm rounded-r-none px-2 flex-auto text-nowrap">
            {t("history.use")}
          </button>
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-sm border-l-neutral-content rounded-l-none px-2"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-base-100 rounded-box z-[1] shadow border"
            >
              <li>
                <a>Unpin</a>
              </li>
              <li>
                <a>Pin</a>
              </li>
              <li>
                <a>{t("history.delete")}</a>
              </li>
            </ul>
          </div>
        </div>
      </td>
    </tr>
  );
}
