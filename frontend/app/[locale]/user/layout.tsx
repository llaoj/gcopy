import { NextIntlClientProvider, useMessages } from "next-intl";

export default function UserLayout({
  params: { locale },
  children,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = useMessages();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center mx-auto px-4">
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </div>
  );
}
