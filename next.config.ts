import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // OpenAI 兼容 API 的惯例是 /v1/*, 但 Next 路由在 src/app/api/v1 下对应 /api/v1/*
  // 对外暴露 /v1/* 以便 Cursor/OpenAI SDK 等客户端用 base_url=https://host/v1 直接工作
  async rewrites() {
    return [
      { source: "/v1/:path*", destination: "/api/v1/:path*" },
    ];
  },
};

export default nextConfig;
