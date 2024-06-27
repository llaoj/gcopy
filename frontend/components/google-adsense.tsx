import Script from "next/script";

export default function GoogleAdsense({ pId }: { pId?: string }) {
  if (process.env.NODE_ENV !== "production" || !pId) {
    return null;
  }

  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${pId}"
      crossOrigin="anonymous"
    />
  );
}
