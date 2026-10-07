import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // @libsql/client 带有原生依赖，交给 Node 直接 require，不参与打包
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
