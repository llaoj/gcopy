"use client";

import { NextIntlClientProvider } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import en from "@/messages/en.json";
import zhCN from "@/messages/zh-CN.json";
import moment from "moment";
import "moment/locale/zh-cn";

const messagesMap: Record<string, Record<string, any>> = { en, "zh-CN": zhCN };
const LocaleContext = createContext<string>("en");

export function useLocale() {
  return useContext(LocaleContext);
}

function detectBrowserLocale(): string {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    setLocale(detectBrowserLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
    moment.locale(locale === "zh-CN" ? "zh-cn" : "en");

    const msgs = messagesMap[locale];
    if (msgs?.Metadata) {
      document.title = msgs.Metadata.title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", msgs.Metadata.description);
    }
  }, [locale]);

  const messages = messagesMap[locale];

  return (
    <LocaleContext.Provider value={locale}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
