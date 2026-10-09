import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
