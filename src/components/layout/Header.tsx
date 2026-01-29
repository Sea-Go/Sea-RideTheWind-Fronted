import Link from "next/link";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <nav className="flex space-x-6 text-sm font-medium">
          <Link href="/dashboard" className="text-red-500 hover:text-red-700">
            首页
          </Link>
          <Link href="/post" className="text-gray-600 hover:text-gray-800">
            发布
          </Link>
          <Link href="/messages" className="text-gray-600 hover:text-gray-800">
            消息
          </Link>
          <Link href="/profile" className="text-gray-600 hover:text-gray-800">
            我
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          <Link
            href="/login"
            className="rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white"
          >
            登录
          </Link>
        </div>
      </div>
    </header>
  );
};
