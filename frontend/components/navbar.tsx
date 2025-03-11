"use client";

import Avator from "@/components/avator";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import useAuth from "@/lib/auth";
import pack from "@/package.json";

export default function Navbar() {
  const locale = useLocale();
  const t = useTranslations("Navbar");
  const { isLoading, loggedIn } = useAuth();
  if (isLoading) {
    return null;
  }

  return (
    <div className="navbar bg-base-100 shadow-xl rounded-box">
      <div className="navbar-start">
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
          >
            <li>
              <Link
                href={
                  locale == "zh"
                    ? "https://github.com/llaoj/gcopy/blob/v" +
                      pack.version +
                      "/docs/zh-CN/README.md"
                    : "https://github.com/llaoj/gcopy/blob/v" +
                      pack.version +
                      "/README.md"
                }
                target="_blank"
              >
                {t("title")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="navbar-center">
        <a className="btn btn-ghost text-xl" href="/">
          GCopy
        </a>
      </div>
      <div className="navbar-end">
        <a
          className="btn btn-ghost btn-circle"
          target="_blank"
          href="https://github.com/llaoj/gcopy"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="h-5 w-5"
            viewBox="0 0 16 16"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        {loggedIn ? (
          <Avator />
        ) : (
          <Link className="btn" href={`/${locale}/user/email-code`}>
            {t("signIn")}
          </Link>
        )}
      </div>
    </div>
  );
}
