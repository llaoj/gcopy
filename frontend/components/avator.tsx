import { useState } from "react";
import useAuth from "@/lib/auth";
import useSystemInfo from "@/hooks/useSystemInfo";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

export default function Avator() {
  const locale = useLocale();
  const t = useTranslations("Avator");
  const [clicked, setClicked] = useState(false);
  const router = useRouter();
  const { isLoading, userId, logout } = useAuth();
  const { authMode } = useSystemInfo();

  if (isLoading) {
    return null;
  }

  // Use userId for display
  const displayText = userId || "";
  const initials = displayText.substring(0, 2).toUpperCase();

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
        className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
      >
        <li>
          <a className="text-neutral-content btn-disabled">
            <span className="truncate">{displayText}</span>
          </a>
        </li>
        <li>
          <button
            disabled={clicked}
            onClick={async () => {
              setClicked(true);
              await logout();
              // Redirect based on auth mode
              if (authMode === "token") {
                router.push(`/${locale}/user/token`);
              } else {
                router.push(`/${locale}/user/email`);
              }
            }}
          >
            {t("logout")}
          </button>
        </li>
      </ul>
    </div>
  );
}
