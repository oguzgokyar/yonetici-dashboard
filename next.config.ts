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
      {
        source: "/developer-tools/growth-archive",
        destination: "/growth-archive",
        permanent: false,
      },
      {
        source: "/developer-tools/library",
        destination: "/growth-archive",
        permanent: false,
      },
      {
        source: "/developer-tools/meeting",
        destination: "/meeting",
        permanent: false,
      },
      {
        source: "/developer-tools/teklif",
        destination: "/teklif",
        permanent: false,
      },
      {
        source: "/developer-tools/instagram-growth",
        destination: "/instagram-growth",
        permanent: false,
      },
      {
        source: "/developer-tools/growth-agent",
        destination: "/instagram-growth",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
