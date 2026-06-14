import { Inter } from "next/font/google";

import "@/app/globals.css";
import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { I18nProvider } from "@/lib/i18n";

import en from "@/messages/en.json";

export const metadata: Metadata = {
  title: en.Metadata.title,
  description: en.Metadata.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-base-200`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
      {process.env.GOOGLE_ANALYTICS_ID && (
        <GoogleAnalytics gaId={process.env.GOOGLE_ANALYTICS_ID} />
      )}
    </html>
  );
}
