"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Logo from "@/components/logo";

export default function Email({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const [clicked, setClicked] = useState<boolean>(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState<string>(searchParams.email || "");
  const [errorMessage, setErrorMessage] = useState("");
  const locale = useLocale();
  const t = useTranslations("EmailLogin");
  const router = useRouter();

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setClicked(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const emailValue = formData.get("email") as string;

    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(emailValue)) {
      setErrorMessage(t("invalidEmail"));
      setClicked(false);
      return;
    }

    const res = await fetch("/api/v1/user/email/code", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ email: emailValue }),
    });

    if (res.status === 200) {
      setEmail(emailValue);
      setStep("code");
      window.history.pushState(
        {},
        "",
        `/${locale}/user/email?email=${emailValue}`,
      );
    } else {
      setErrorMessage(t("sendEmailFailed"));
    }
    setClicked(false);
  };

  const handleCodeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setClicked(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const emailValue = formData.get("email") as string;
    const code = formData.get("code") as string;

    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(emailValue)) {
      setErrorMessage(t("invalidEmail"));
      setClicked(false);
      return;
    }

    if (!/\d{6}/i.test(code)) {
      setErrorMessage(t("incorrectCode"));
      setClicked(false);
      return;
    }

    const res = await fetch("/api/v1/user/email/verify", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        email: emailValue,
        code: code,
      }),
    });

    if (res.status === 200) {
      router.push(`/${locale}/`);
      return;
    }

    setErrorMessage(t("authenticationFailed"));
    setClicked(false);
  };

  const handleBack = () => {
    setStep("email");
    setErrorMessage("");
    window.history.pushState({}, "", `/${locale}/user/email`);
  };

  return (
    <form
      onSubmit={step === "email" ? handleEmailSubmit : handleCodeSubmit}
      className="card w-full md:w-[32rem] bg-base-100 shadow-xl"
    >
      <div className="card-body gap-4">
        <Logo />
        <div className="flex items-center">
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-xs"
            onClick={step === "code" ? handleBack : undefined}
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
          </button>
          <span className="ml-1">{step === "code" ? email : t("back")}</span>
        </div>
        {step === "email" ? (
          <>
            <div className="flex flex-col gap-0">
              <h2 className="card-title">{t("title")}</h2>
              <span className="text-xs">{t("smallTitle")}</span>
            </div>
            <p>{t("subTitle")}</p>
            <div>
              <input
                name="email"
                type="text"
                placeholder={t("placeholder")}
                className="input input-bordered w-full"
                defaultValue={email}
                autoFocus
              />
              <span className="text-xs">{t("tip")}</span>
            </div>
          </>
        ) : (
          <>
            <h2 className="card-title">{t("codeTitle")}</h2>
            <p>{t("codeSubTitle", { email: email })}</p>
            <div>
              <input name="email" type="hidden" value={email} />
              <input
                name="code"
                type="text"
                placeholder={t("codePlaceholder")}
                className="input input-bordered w-full"
                autoFocus
              />
              <span className="text-xs">{t("tip")}</span>
            </div>
          </>
        )}
        {errorMessage && <p className="text-error">{errorMessage}</p>}
        <div className="card-actions justify-end">
          <button className="btn btn-primary" type="submit" disabled={clicked}>
            {step === "email" ? t("buttonText") : t("codeButtonText")}
          </button>
        </div>
      </div>
    </form>
  );
}
