"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Logo from "@/components/logo";

export default function Login({
  searchParams,
}: {
  searchParams: { email: string };
}) {
  const [clicked, setClicked] = useState<boolean>(false);
  const locale = useLocale();
  const t = useTranslations("Login");
  const email = searchParams.email;
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const validateEmailCode = async (event: FormEvent) => {
    event.preventDefault();
    setClicked(true);
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const email = formData.get("email") as string;
    const code = formData.get("code") as string;
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(email)) {
      setErrorMessage(t("invalidEmail"));
      setClicked(false);
      return;
    }
    if (!/\d{6}/i.test(code)) {
      setErrorMessage(t("incorrectCode"));
      setClicked(false);
      return;
    }
    const res = await fetch("/api/v1/user/login", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        email: email,
        code: code,
      }),
    });

    if (res.status == 200) {
      router.push(`/${locale}/`);
      return;
    }

    setErrorMessage(t("authenticationFailed"));
    setClicked(false);
  };

  return (
    <form
      onSubmit={validateEmailCode}
      className="card w-full md:w-[32rem] bg-base-100 shadow-xl"
    >
      <div className="card-body gap-4">
        <Logo />
        <div className="flex items-center">
          <a
            className="btn btn-ghost btn-circle btn-xs"
            href={`/${locale}/user/email-code?email=${email}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </a>
          <span className="ml-1">{email}</span>
        </div>
        <h2 className="card-title">{t("title")}</h2>
        <p>{t("subTitle", { email: email })}</p>
        <div>
          <input name="email" type="hidden" value={email} />
          <input
            name="code"
            type="text"
            placeholder={t("placeholder")}
            className="input input-bordered w-full"
            autoFocus
          />
          <span className="text-xs">{t("tip")}</span>
        </div>
        {errorMessage && <p className="text-error">{errorMessage}</p>}
        <div className="card-actions justify-end">
          <button className="btn btn-primary" type="submit" disabled={clicked}>
            {t("buttonText")}
          </button>
        </div>
      </div>
    </form>
  );
}
