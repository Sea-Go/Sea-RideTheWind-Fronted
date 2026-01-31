import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 禁用图片优化以避免兼容性问题
    unoptimized: true,

    // 移除可能导致干扰的远程模式配置
    remotePatterns: [],

    // 空的域名列表，避免域名验证问题
    domains: [],

    // 简化配置，专注于本地静态图片
    formats: [],

    // 设置合适的设备尺寸
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
