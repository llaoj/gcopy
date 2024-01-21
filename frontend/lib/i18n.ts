import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

export const locales = ["en", "zh"];
export const defaultLocale = "en";
export function getAcceptLanguageLocale(requestHeaders: Headers) {
  let locale;
  const languages = new Negotiator({
    headers: {
      "accept-language": requestHeaders.get("accept-language") || undefined,
    },
  }).languages();
  try {
    locale = match(
      languages,
      locales as unknown as Array<string>,
      defaultLocale,
    );
  } catch (e) {
    // Invalid language
  }
  return locale || defaultLocale;
}
