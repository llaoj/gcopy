import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GCopy - Sync text screenshot & file",
  description:
    "A clipboard synchronization web service for different devices that can synchronize text, screenshots, and files.",
};

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
    </html>
  );
}
