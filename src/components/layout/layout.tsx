// 全局布局（Header + Footer）

// src/app/layout.tsx
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sea TryGo",
  description: "你的社交分享平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="font-sans">{children}</body>
    </html>
  );
}
