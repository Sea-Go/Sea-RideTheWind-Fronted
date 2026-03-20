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
  title: "Sea TryGo",
  description: "我喜欢你",
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
