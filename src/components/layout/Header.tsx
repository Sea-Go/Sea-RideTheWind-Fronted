"use client";

import {
  HomeIcon,
  InfoIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PenBoxIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type MouseEvent, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clearAuthToken, getAuthToken } from "@/services/auth";

const navItems = [
  { href: "/dashboard", label: "首页", icon: HomeIcon },
  { href: "/post", label: "发布", icon: PenBoxIcon },
  { href: "/messages", label: "消息", icon: MessageSquareIcon },
  { href: "/profile", label: "我的", icon: UserIcon },
];

const matchRoute = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const subscribeAuthState = () => () => {};
const getClientAuthState = () => Boolean(getAuthToken());
const getServerAuthState = () => false;

export const Header = () => {
  const pathname = usePathname();
  const router = useRouter();
  const isLoggedIn = useSyncExternalStore(
    subscribeAuthState,
    getClientAuthState,
    getServerAuthState,
  );

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };

  const handleMessageClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    toast.info("消息功能正在开发中~");
  };

  return (
    <header className="border-border bg-background sticky top-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r py-6 shadow-sm">
      <div className="text-primary mb-10 px-8 text-xl font-bold tracking-tight">Sea TryGo</div>

      <nav className="flex w-full flex-1 flex-col space-y-2 px-4 text-sm font-medium">
        {navItems.map((item) => {
          const isActive = matchRoute(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === "/messages" ? handleMessageClick : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        {!isLoggedIn && (
          <div className="pt-4">
            <Button asChild className="w-full rounded-full">
              <Link href="/login">登录</Link>
            </Button>
          </div>
        )}
      </nav>

      <div className="mt-auto px-4 pb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-accent hover:text-foreground h-auto w-full justify-start gap-3 rounded-lg px-4 py-3 text-sm font-medium"
            >
              <MenuIcon className="h-5 w-5" />
              更多
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="mb-2 w-56">
            <DropdownMenuItem className="cursor-pointer gap-2">
              <SettingsIcon className="h-4 w-4" />
              设置
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2">
              <InfoIcon className="h-4 w-4" />
              关于
            </DropdownMenuItem>
            {isLoggedIn && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2"
                >
                  <LogOutIcon className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
