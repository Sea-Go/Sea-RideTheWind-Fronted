import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: "6mb",
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    minimumCacheTTL: 604800,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "175.24.130.226",
        port: "39000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "175.24.130.226",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "sea-ridethewindbreakthewaves.xyz",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "sea-ridethewindbreakthewaves.xyz",
        port: "39000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "sea-ridethewindbreakthewaves.xyz",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
