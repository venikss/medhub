import type { NextConfig } from "next";

const backendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  experimental: {
    proxyTimeout: 180_000,
  },
  transpilePackages: [
    "@cornerstonejs/core",
    "@cornerstonejs/tools",
    "@cornerstonejs/metadata",
    "@cornerstonejs/dicom-image-loader",
    "dicom-parser",
  ],
  turbopack: {
    resolveAlias: {
      fs: "./src/stubs/empty.js",
      "@cornerstonejs/metadata": "./node_modules/@cornerstonejs/metadata/dist/esm/index.js",
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendOrigin}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
