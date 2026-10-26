import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: "/projects/:projectId/canva-generation",
        destination: "/projects/:projectId/image-generation?studio=canva",
        permanent: false,
      },
      {
        source: "/canva-generation",
        destination: "/projects",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
