import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/lib/i18n";

export default createMiddleware({
  locales: locales,
  defaultLocale: defaultLocale,
});

export const config = {
  matcher: ["/", "/(en|zh)/:path*"],
};
