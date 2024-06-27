import { Inter } from "next/font/google";
import "@/app/globals.css";
import { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Viewport } from "next";
import GoogleAdsense from "@/components/google-adsense";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-base-200`}>{children}</body>
      <GoogleAdsense pId={process.env.GoogleAdsensePId} />
    </html>
  );
}
