"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { FRONTEND_MOTION_CONFIG, FRONTEND_MOTION_VARIABLES } from "./motion-config";
import { markNavigationStart } from "./navigation-timing";

const CLICK_RIPPLE_BLOCK_SELECTOR = [
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable='true']",
  "[data-no-click-ripple]",
  "[disabled]",
  "[aria-disabled='true']",
  "button:disabled",
  ".bytemd",
  ".CodeMirror",
].join(",");

const canUseFineMotion = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  const lowPowerDevice =
    typeof navigatorWithMemory.deviceMemory === "number" &&
    navigatorWithMemory.deviceMemory <= 4 &&
    navigator.hardwareConcurrency <=
      FRONTEND_MOTION_CONFIG.pointer.lowPowerHardwareConcurrency;

  return !reducedMotion && !coarsePointer && !lowPowerDevice;
};

const PointerAura = ({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) => {
  const auraRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const aura = auraRef.current;
    if (!root || !aura || !FRONTEND_MOTION_CONFIG.features.pointerAura || !canUseFineMotion()) {
      return;
    }

    let frame = 0;
    let nextX = window.innerWidth / 2;
    let nextY = window.innerHeight / 2;

    const syncPointer = () => {
      frame = 0;
      root.style.setProperty("--sea-pointer-x", `${nextX}px`);
      root.style.setProperty("--sea-pointer-y", `${nextY}px`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      nextX = event.clientX;
      nextY = event.clientY;
      root.dataset.pointerActive = "true";
      if (!frame) {
        frame = window.requestAnimationFrame(syncPointer);
      }
    };

    const handlePointerLeave = () => {
      root.dataset.pointerActive = "false";
    };

    root.dataset.pointerActive = "false";
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", handlePointerLeave);
    document.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handlePointerLeave);
      document.removeEventListener("mouseleave", handlePointerLeave);
    };
  }, [rootRef]);

  return <div ref={auraRef} aria-hidden className="sea-pointer-aura" />;
};

const ClickRippleLayer = () => {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !FRONTEND_MOTION_CONFIG.features.clickRipple || !canUseFineMotion()) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.pointerType && event.pointerType !== "mouse")) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement && target.closest(CLICK_RIPPLE_BLOCK_SELECTOR)) {
        return;
      }

      const ripple = document.createElement("span");
      ripple.className = "sea-click-ripple";
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      layer.appendChild(ripple);

      window.setTimeout(() => {
        ripple.remove();
      }, FRONTEND_MOTION_CONFIG.duration.ripple + 80);
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return <div ref={layerRef} aria-hidden className="sea-click-ripple-layer" />;
};

const NavigationTimingLayer = () => {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      const nextPath = `${url.pathname}${url.search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath === currentPath) {
        return;
      }

      markNavigationStart(nextPath);
    };

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  return null;
};

export const MotionProvider = ({
  children,
  className,
  enabled = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  enabled?: boolean;
  style?: CSSProperties;
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mergedStyle = enabled ? { ...FRONTEND_MOTION_VARIABLES, ...style } : style;

  return (
    <div
      ref={rootRef}
      data-sea-motion-root={enabled ? "true" : undefined}
      className={cn(enabled && "sea-motion-root", className)}
      style={mergedStyle}
    >
      {children}
      {enabled ? (
        <>
          <NavigationTimingLayer />
          <PointerAura rootRef={rootRef} />
          <ClickRippleLayer />
        </>
      ) : null}
    </div>
  );
};
