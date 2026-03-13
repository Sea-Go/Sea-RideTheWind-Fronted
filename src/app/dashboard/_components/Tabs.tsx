"use client";

// Dashboard 标签切换组件，基于路由高亮并支持直接跳转子页面。
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DashboardTabSlug } from "@/app/dashboard/_constants/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: ReadonlyArray<{ slug: DashboardTabSlug; label: string }>;
}

export const Tabs = ({ tabs }: TabsProps) => {
  const pathname = usePathname();

  return (
    <div className="scrollbar-hide mb-6 flex space-x-2 overflow-x-auto pb-2">
      {tabs.map((tab) => {
        const href = `/dashboard/${tab.slug}`;
        const isActive = pathname === href;

        return (
          <Button
            key={tab.slug}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            className={cn(
              "rounded-full px-3",
              isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            asChild
          >
            <Link href={href}>{tab.label}</Link>
          </Button>
        );
      })}
    </div>
  );
};
