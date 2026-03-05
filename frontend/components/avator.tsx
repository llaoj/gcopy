import { useState } from "react";
import useAuth from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

export default function Avator() {
  const locale = useLocale();
  const t = useTranslations("Avator");
  const [clicked, setClicked] = useState(false);
  const router = useRouter();
  const { isLoading, email, token, logout } = useAuth();
  if (isLoading) {
    return null;
  }

  // Use email or token for display
  const displayText = email || token || "";
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
              // Redirect based on auth mode (check system info)
              const response = await fetch("/api/v1/systeminfo");
              if (response.ok) {
                const sysInfo = await response.json();
                if (sysInfo.authMode === "token") {
                  router.push(`/${locale}/user/token`);
                } else {
                  router.push(`/${locale}/user/email-code`);
                }
              } else {
                router.push(`/${locale}/user/email-code`);
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
