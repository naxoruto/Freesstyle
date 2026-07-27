/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@freestyle/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.SERVER_INTERNAL_URL || "http://127.0.0.1:3001"}/api/:path*`,
      },
    ];
  },
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? { output: "standalone" } : {}),
};

module.exports = nextConfig;
