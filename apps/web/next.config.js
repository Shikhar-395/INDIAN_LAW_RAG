/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/db", "@repo/rag", "@repo/ui"],
};

export default nextConfig;
