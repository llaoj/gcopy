import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import useAuth from "@/lib/auth";
import useSystemInfo from "@/hooks/useSystemInfo";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getLoginPath, redirectToLogin } from "@/lib/navigation";

export default function Avator() {
  const locale = useLocale();
  const t = useTranslations("Avator");
  const [clicked, setClicked] = useState(false);
  const router = useRouter();
  const { isLoading, userId, logout } = useAuth();
  const { systemInfo } = useSystemInfo();

  if (isLoading) {
    return null;
  }

  // Use userId for display
  const displayText = userId || "";
  const initials = displayText.substring(0, 2).toUpperCase();

  // 生成二维码 URL
  const getQRCodeUrl = () => {
    if (!systemInfo?.authMode || !userId) {
      return "";
    }

    const baseUrl = window.location.origin;
    const loginPath = getLoginPath(systemInfo.authMode, locale);
    const encodedUserId = encodeURIComponent(userId);

    if (systemInfo.authMode === "email") {
      return `${baseUrl}${loginPath}?email=${encodedUserId}`;
    } else if (systemInfo.authMode === "token") {
      return `${baseUrl}${loginPath}?token=${encodedUserId}`;
    }

    return "";
  };

  const qrCodeUrl = getQRCodeUrl();

  const handleLogout = async () => {
    setClicked(true);
    await logout();
    if (systemInfo?.authMode) {
      redirectToLogin(router, systemInfo.authMode, locale);
    }
  };

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-circle avatar placeholder"
      >
        <div className="w-8 rounded-full bg-neutral text-neutral-content">
          <span className="text-xs">{initials}</span>
        </div>
      </div>
      <ul
        tabIndex={0}
        className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box min-w-36 max-w-52"
      >
        {qrCodeUrl && (
          <>
            <li className="flex flex-col btn-disabled">
              <QRCodeSVG value={qrCodeUrl} size={160} level="M" />
              <div className="text-xs">{t("scanQRLogin")}</div>
            </li>
            <li></li>
          </>
        )}
        <li>
          <a className="btn-disabled">
            <span className="truncate">{displayText}</span>
          </a>
        </li>
        <li>
          <button disabled={clicked} onClick={handleLogout}>
            {t("logout")}
          </button>
        </li>
      </ul>
    </div>
  );
}
