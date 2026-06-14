"use client";

import { NextIntlClientProvider } from "next-intl";
import {
  createContext,
  useContext,
  useState,
  useEffect,
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

export function detectLocale(): string {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<string>("en");

  useEffect(() => {
    const detected = detectLocale();
    setLocale(detected);
    document.documentElement.lang = detected === "zh-CN" ? "zh-CN" : "en";
    moment.locale(detected === "zh-CN" ? "zh-cn" : "en");

    const msgs = messagesMap[detected];
    if (msgs?.Metadata) {
      document.title = msgs.Metadata.title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", msgs.Metadata.description);
    }
  }, []);

  const messages = messagesMap[locale];

  return (
    <LocaleContext.Provider value={locale}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
