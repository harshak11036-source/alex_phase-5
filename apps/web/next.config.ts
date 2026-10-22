import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  cacheComponents: false,
  partialPrefetching: false,
  typescript: {
    // Ignore build errors caused by pre-existing TypeScript stack overflow
    // in complex Prisma types (TypeScript 5.9.3 + Prisma 5.22)
    // See: https://github.com/prisma/prisma/issues/25000
    ignoreBuildErrors: true,
  },
  // The dashboard shell historically linked to feature URLs under
  // `/dashboard/*`, while the App Router feature pages live at the root
  // (`/assistant`, `/documents`, etc.) inside the dashboard route group.
  // Use `:path+` (one or more segments) so `/dashboard` itself routes to
  // `(dashboard)/dashboard/page.tsx` instead of rewriting to `/`.
  async rewrites() {
    return [{
      source: "/dashboard/:path+",
      destination: "/:path+",
    }];
  },
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
