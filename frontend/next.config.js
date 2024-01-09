/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: process.env.SERVER_URL + "/api/v1/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
