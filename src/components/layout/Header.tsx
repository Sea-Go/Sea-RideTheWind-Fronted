// 顶部导航栏组件

// src/components/common/layout/Header.tsx
import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b bg-white shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          Sea TryGo
        </Link>
        <nav className="flex space-x-6">
          <Link href="/home" className="hover:text-blue-600">
            首页
          </Link>
          <Link href="/publish" className="hover:text-blue-600">
            发布
          </Link>
          <Link href="/messages" className="hover:text-blue-600">
            消息
          </Link>
          <Link href="/profile" className="hover:text-blue-600">
            我
          </Link>
        </nav>
      </div>
    </header>
  );
}
