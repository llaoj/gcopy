import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GCopy - Sync text screenshot & file",
  description:
    "A clipboard synchronization web service for different devices that can synchronize text, screenshots, and files.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-base-200`}>{children}</body>
    </html>
  );
}
