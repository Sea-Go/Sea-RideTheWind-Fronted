import Link from "next/link";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <nav className="flex gap-4 border-b p-4">
          {/* <Link href="/">首页</Link> */}
          <Link href="/dashboard">首页</Link>
          <Link href="/login">登录</Link>
          <Link href="/explore">发现</Link>
        </nav>
      </main>
      <Footer />
    </div>
  );
}
