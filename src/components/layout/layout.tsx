"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { shouldEnableFrontendMotion } from "@/components/motion/motion-config";
import { MotionPage } from "@/components/motion/MotionPage";
import { MotionProvider } from "@/components/motion/MotionProvider";
import {
  DEFAULT_PROFILE_THEME_ID,
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  profileThemeMap,
  resolveProfileThemeId,
  shouldApplyFrontendTheme,
} from "@/components/profile/profile-theme-config";
import { cn } from "@/lib/utils";

import { Footer } from "./Footer";
import { Header } from "./Header";

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  mainClassName?: string;
}

export const Layout = ({ children, hideFooter = false, mainClassName }: LayoutProps) => {
  const pathname = usePathname();
  const shouldApplyTheme = shouldApplyFrontendTheme(pathname);
  const [themeId, setThemeId] = useState(DEFAULT_PROFILE_THEME_ID);

  useEffect(() => {
    if (typeof window === "undefined" || !shouldApplyTheme) {
      return;
    }

    const syncTheme = (value?: string | null) => {
      setThemeId(
        resolveProfileThemeId(value ?? window.localStorage.getItem(PROFILE_THEME_STORAGE_KEY)),
      );
    };

    syncTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PROFILE_THEME_STORAGE_KEY) {
        return;
      }

      syncTheme(event.newValue);
    };

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ themeId?: string }>;
      syncTheme(customEvent.detail?.themeId);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PROFILE_THEME_EVENT_NAME, handleThemeChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PROFILE_THEME_EVENT_NAME, handleThemeChange as EventListener);
    };
  }, [shouldApplyTheme]);

  const theme = shouldApplyTheme ? profileThemeMap[themeId] : null;
  const shouldApplyMotion = shouldEnableFrontendMotion(pathname);

  return (
    <MotionProvider
      enabled={shouldApplyMotion}
      className="bg-background text-foreground flex min-h-screen flex-col transition-[background-color,border-color,color] duration-300 lg:flex-row"
      style={theme?.style}
    >
      <Header />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: theme ? "var(--app-page-overlay)" : undefined }}
        />
        <main className={cn("relative z-10 min-h-0 min-w-0 flex-1", mainClassName)}>
          <MotionPage enabled={shouldApplyMotion}>{children}</MotionPage>
        </main>
        {hideFooter ? null : <Footer />}
      </div>
    </MotionProvider>
  );
};
