import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import useAuth from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getLoginPath, redirectToLogin } from "@/lib/navigation";

export default function Avator() {
  const t = useTranslations("Avator");
  const [clicked, setClicked] = useState(false);
  const [copied, setCopied] = useState<"link" | "token" | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { isLoading, userId, logout } = useAuth();

  const showCopied = useCallback((target: "link" | "token") => {
    setCopied(target);
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = setTimeout(() => setCopied(null), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return null;
  }

  // Use userId for display
  const displayText = userId || "";
  const initials = displayText.substring(0, 2).toUpperCase();

  // 生成二维码 URL
  const getQRCodeUrl = () => {
    if (!userId) {
      return "";
    }

    const baseUrl = window.location.origin;
    const encodedUserId = encodeURIComponent(userId);
    return `${baseUrl}${getLoginPath()}?token=${encodedUserId}`;
  };

  const qrCodeUrl = getQRCodeUrl();

  const handleLogout = async () => {
    setClicked(true);
    await logout();
    redirectToLogin(router);
  };

  const handleCopyLink = async () => {
    if (!qrCodeUrl) return;
    try {
      await navigator.clipboard.writeText(qrCodeUrl);
      showCopied("link");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyToken = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      showCopied("token");
    } catch (err) {
      console.error("Failed to copy token:", err);
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
              <div className="text-xs pb-0">{t("scanQRLogin")}</div>
              <QRCodeSVG
                value={qrCodeUrl}
                size={160}
                level="M"
                className="pt-0"
              />
            </li>
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink();
                }}
              >
                <span className="min-w-0 flex-1 truncate">{t("copyLink")}</span>
                <span className="w-16 shrink-0 text-right text-success">
                  {copied === "link" ? t("copied") : ""}
                </span>
              </button>
            </li>
            <li></li>
          </>
        )}
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyToken();
            }}
          >
            <span className="min-w-0 flex-1 truncate">{displayText}</span>
            <span className="w-16 shrink-0 text-right text-success">
              {copied === "token" ? t("copied") : ""}
            </span>
          </button>
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
