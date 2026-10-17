/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

// Dev mode: proxy API requests to backend
if (process.env.NODE_ENV === "development") {
  delete nextConfig.output;
  // Avoid Next redirecting /api/... to /api/.../ (from trailingSlash), which
  // otherwise adds an extra 308 hop on every API call.
  nextConfig.skipTrailingSlashRedirect = true;
  nextConfig.rewrites = () =>
    Promise.resolve([
      {
        source: "/api/:path*",
        destination: `${process.env.SERVER_URL}/api/:path*`,
      },
    ]);
}

module.exports = nextConfig;
