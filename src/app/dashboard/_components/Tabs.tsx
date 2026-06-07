"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import type { DashboardTabSlug } from "@/app/dashboard/_constants/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: ReadonlyArray<{ slug: DashboardTabSlug; label: string }>;
}

export const Tabs = ({ tabs }: TabsProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const prefetchTab = useCallback(
    (slug: DashboardTabSlug) => {
      router.prefetch(`/dashboard/${slug}`);
    },
    [router],
  );

  useEffect(() => {
    tabs.forEach((tab) => {
      prefetchTab(tab.slug);
    });
  }, [prefetchTab, tabs]);

  return (
    <div className="scrollbar-hide mb-6 flex gap-3 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const href = `/dashboard/${tab.slug}`;
        const isActive = pathname === href;

        return (
          <Button
            key={tab.slug}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-xs sm:text-sm",
              isActive
                ? "shadow-md shadow-primary/20"
                : "hover:text-primary text-muted-foreground hover:bg-accent/70 bg-transparent hover:shadow-sm",
            )}
            asChild
          >
            <Link
              href={href}
              prefetch
              onFocus={() => prefetchTab(tab.slug)}
              onPointerEnter={() => prefetchTab(tab.slug)}
            >
              {tab.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
};
