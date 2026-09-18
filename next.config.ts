import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
};

export default nextConfig;
