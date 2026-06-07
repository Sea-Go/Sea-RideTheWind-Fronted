"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { FRONTEND_MOTION_CONFIG } from "./motion-config";
import { markNavigationTiming } from "./navigation-timing";

const getMotionPageKey = (pathname: string): string => {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }

  return pathname;
};

export const MotionPage = ({
  children,
  className,
  enabled = true,
}: {
  children: ReactNode;
  className?: string;
  enabled?: boolean;
}) => {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const pageKey = useMemo(() => getMotionPageKey(pathname), [pathname]);

  useEffect(() => {
    markNavigationTiming("nav:path-change", { pathname });
    const frame = window.requestAnimationFrame(() => {
      markNavigationTiming("nav:content-ready", { pathname });
      if (pageKey === "dashboard" || shouldReduceMotion || !FRONTEND_MOTION_CONFIG.features.pageTransition) {
        markNavigationTiming("nav:motion-settled", { pathname });
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pageKey, pathname, shouldReduceMotion]);

  if (!enabled || !FRONTEND_MOTION_CONFIG.features.pageTransition) {
    return <div className={className}>{children}</div>;
  }

  const variants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
      };

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={pageKey}
        className={cn("min-h-full", className)}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration: shouldReduceMotion ? 0.12 : FRONTEND_MOTION_CONFIG.duration.page / 1000,
          ease: FRONTEND_MOTION_CONFIG.easing.entranceCurve,
        }}
        onAnimationComplete={() => {
          markNavigationTiming("nav:motion-settled", { pathname });
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
