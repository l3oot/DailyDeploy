import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth cookies + interactive session pages should not be statically cached.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
