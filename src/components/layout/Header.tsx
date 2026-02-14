"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { PageContainer } from "./PageContainer";

const navItems = [
  { href: "/dashboard", label: "首页" },
  { href: "/post", label: "发布" },
  { href: "/messages", label: "消息" },
  { href: "/profile", label: "我" },
];

const matchRoute = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const Header = () => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <PageContainer className="flex items-center justify-between py-3">
        <nav className="flex space-x-6 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = matchRoute(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors",
                  isActive
                    ? "text-red-500 hover:text-red-700"
                    : "text-gray-600 hover:text-gray-800",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center space-x-4">
          <Link
            href="/login"
            className="rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white"
          >
            登录
          </Link>
        </div>
      </PageContainer>
    </header>
  );
};
