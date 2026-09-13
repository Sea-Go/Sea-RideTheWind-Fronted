import type { Metadata } from "next";

import { AppPromptProvider } from "@/components/common/AppPromptProvider";
import { FrontendThemeProvider } from "@/components/profile/FrontendThemeProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sea 识海 · 与世界保持好奇",
  description: "识海社区中文内容平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased" suppressHydrationWarning>
        <FrontendThemeProvider>
          <AppPromptProvider>{children}</AppPromptProvider>
        </FrontendThemeProvider>
      </body>
    </html>
  );
}
