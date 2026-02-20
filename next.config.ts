// ============================================
// FILE: next.config.ts
// Next.js configuration with secure image domains
// ============================================

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // AWS S3 - Your bucket
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
      // Flaticon - Default avatars
      {
        protocol: "https",
        hostname: "cdn-icons-png.flaticon.com",
      },
      // Unsplash - Hero images
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Gravatar - User avatars
      {
        protocol: "https",
        hostname: "*.gravatar.com",
      },
      // Google - OAuth profile pictures
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // GitHub - OAuth profile pictures
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;