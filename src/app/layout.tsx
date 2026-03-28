import type { Metadata } from "next";

import { AppPromptProvider } from "@/components/common/AppPromptProvider";
import { RecoPrewarm } from "@/components/common/RecoPrewarm";

import "./globals.css";

export const metadata: Metadata = {
  title: "识海社区",
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
        <AppPromptProvider>{children}</AppPromptProvider>
        <RecoPrewarm />
      </body>
    </html>
  );
}
