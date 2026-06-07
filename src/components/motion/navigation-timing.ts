"use client";

export type NavigationTimingMarkName =
  | "nav:start"
  | "nav:path-change"
  | "nav:content-ready"
  | "nav:motion-settled";

interface NavigationTimingEntry {
  detail?: Record<string, string | number | boolean | null | undefined>;
  name: NavigationTimingMarkName;
  time: number;
}

declare global {
  interface Window {
    __SEA_NAV_TIMINGS__?: NavigationTimingEntry[];
  }
}

export const isNavigationTimingEnabled = (): boolean =>
  typeof window !== "undefined" && process.env.NODE_ENV !== "production";

export const markNavigationTiming = (
  name: NavigationTimingMarkName,
  detail?: NavigationTimingEntry["detail"],
): void => {
  if (!isNavigationTimingEnabled()) {
    return;
  }

  const time = window.performance.now();
  window.__SEA_NAV_TIMINGS__ ??= [];
  if (name === "nav:start") {
    window.__SEA_NAV_TIMINGS__ = [];
  }

  window.__SEA_NAV_TIMINGS__.push({ detail, name, time });
  window.performance.mark(name);
  console.debug(`[sea-nav] ${name} ${time.toFixed(1)}ms`, detail ?? {});
};

export const markNavigationStart = (href: string): void => {
  markNavigationTiming("nav:start", { href });
};
