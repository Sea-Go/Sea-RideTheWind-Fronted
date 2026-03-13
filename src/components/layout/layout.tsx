// 页面布局容器，统一提供页头页脚与全局背景样式。
import type { ReactNode } from "react";

import { Footer } from "./Footer";
import { Header } from "./Header";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <Header />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
};
