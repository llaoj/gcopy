"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Logo from "@/components/logo";

export default function TokenLogin({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const [showVerifyForm, setShowVerifyForm] = useState<boolean>(
    !!searchParams.token,
  );
  const [clicked, setClicked] = useState<boolean>(false);
  const [generatedToken, setGeneratedToken] = useState<string>("");
  const [inputToken, setInputToken] = useState<string>(
    searchParams.token || "",
  );
  const [copied, setCopied] = useState<boolean>(false);
  const locale = useLocale();
  const t = useTranslations("TokenLogin");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  // 当有 URL 参数时，自动切换到验证表单
  useEffect(() => {
    if (searchParams.token) {
      setShowVerifyForm(true);
      setInputToken(searchParams.token);
    }
  }, [searchParams.token]);

  const generateToken = async () => {
    setClicked(true);
    setErrorMessage("");

    const res = await fetch("/api/v1/user/token/generate", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    });

    if (res.status == 200) {
      const data = await res.json();
      setGeneratedToken(data.userId);
      setClicked(false);
      return;
    }

    setErrorMessage(t("generateFailed"));
    setClicked(false);
  };

  const verifyToken = async (event: FormEvent) => {
    event.preventDefault();
    setClicked(true);
    setErrorMessage("");

    // 前端校验：长度必须为6
    if (!inputToken || inputToken.length !== 6) {
      setErrorMessage(t("invalidToken"));
      setClicked(false);
      return;
    }

    // 前端校验：只允许字母和数字（A-Z, a-z, 0-9）
    const tokenPattern = /^[A-Za-z0-9]{6}$/;
    if (!tokenPattern.test(inputToken)) {
      setErrorMessage(t("invalidToken"));
      setClicked(false);
      return;
    }

    const res = await fetch("/api/v1/user/token/verify", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ token: inputToken }),
    });

    if (res.status == 200) {
      router.push(`/${locale}`);
      return;
    }

    // 处理后端返回的错误
    try {
      const data = await res.json();
      setErrorMessage(data.message || t("verifyFailed"));
    } catch {
      setErrorMessage(t("verifyFailed"));
    }
    setClicked(false);
  };

  return (
    <div className="card w-full md:w-[32rem] bg-base-100 shadow-xl">
      <div className="card-body gap-4">
        <Logo />
        <div className="flex items-center">
          <button
            className="btn btn-ghost btn-circle btn-xs"
            onClick={() => {
              if (showVerifyForm) {
                // 如果在填写令牌页面，返回到生成令牌页面
                setShowVerifyForm(false);
                setErrorMessage("");
              } else if (generatedToken) {
                // 如果已生成令牌，返回到生成页面
                setGeneratedToken("");
                setCopied(false);
              } else {
                // 否则返回首页
                router.push(`/${locale}`);
              }
            }}
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
          <span className="ml-1">{t("back")}</span>
        </div>

        <div className="flex flex-col gap-0">
          <h2 className="card-title">{t("title")}</h2>
        </div>

        {/* Verify token form */}
        {showVerifyForm ? (
          <form onSubmit={verifyToken} className="flex flex-col gap-4">
            <p>{t("verifySubTitle")}</p>

            <div>
              <input
                name="token"
                type="text"
                placeholder={t("placeholder")}
                className="input input-bordered w-full text-center text-xl font-mono"
                maxLength={6}
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                autoFocus
              />
            </div>

            <p className="text-sm">{t("caseSensitive")}</p>

            {errorMessage && <p className="text-error">{errorMessage}</p>}

            <div className="card-actions justify-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={clicked}
              >
                {t("verifyButton")}
              </button>
            </div>
          </form>
        ) : (
          /* Generate token view */
          <div className="flex flex-col gap-4">
            {!generatedToken ? (
              <>
                {/* Warning alert */}
                <div className="flex flex-row items-center justify-start gap-3 bg-warning text-warning-content p-4 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex flex-col gap-2 min-w-0 text-left">
                    <span className="font-bold">{t("warningMessage")}</span>
                    <ul className="list-disc list-inside text-sm">
                      <li>{t("warningItems.intranet")}</li>
                      <li>{t("warningItems.personal")}</li>
                      <li>{t("warningItems.trusted")}</li>
                    </ul>
                  </div>
                </div>

                <p>{t("generateSubTitle")}</p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg flex-1"
                    disabled={clicked}
                    onClick={generateToken}
                  >
                    {t("generateButton")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-primary btn-lg flex-1"
                    onClick={() => {
                      setShowVerifyForm(true);
                      setErrorMessage("");
                    }}
                  >
                    {t("verifyTitle")}
                  </button>
                </div>

                {errorMessage && <p className="text-error">{errorMessage}</p>}
              </>
            ) : (
              /* Show generated token */
              <>
                <div className="flex flex-col gap-2">
                  <p>{t("yourToken")}</p>
                  <div className="join w-full">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="input input-bordered input-lg join-item flex-1 text-center text-2xl font-mono font-bold focus:outline-none"
                    />
                    <button
                      className={`btn btn-lg join-item ${
                        copied
                          ? "btn-outline btn-success"
                          : "btn-outline btn-primary"
                      }`}
                      onClick={() => {
                        navigator.clipboard.writeText(generatedToken);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-sm">{t("caseSensitive")}</p>
                </div>

                <div className="card-actions justify-end">
                  <button
                    className="btn btn-primary"
                    onClick={() => router.push(`/${locale}`)}
                  >
                    {t("startUsing")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
