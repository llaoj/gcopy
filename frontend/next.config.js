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
  nextConfig.rewrites = () =>
    Promise.resolve([
      {
        source: "/api/:path*",
        destination: `${process.env.SERVER_URL}/api/:path*`,
      },
    ]);
}

module.exports = nextConfig;
