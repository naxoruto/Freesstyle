/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@freestyle/shared"],
  output: "standalone",
};

module.exports = nextConfig;
