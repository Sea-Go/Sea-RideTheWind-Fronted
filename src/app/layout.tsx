import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppPromptProvider } from "@/components/common/AppPromptProvider";
import { RecoPrewarm } from "@/components/common/RecoPrewarm";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AppPromptProvider>{children}</AppPromptProvider>
        <RecoPrewarm />
      </body>
    </html>
  );
}
