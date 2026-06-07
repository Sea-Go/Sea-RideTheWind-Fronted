import type { CSSProperties } from "react";

export type MotionIntensity = "balanced";

export type MotionFeature =
  | "pointerAura"
  | "clickRipple"
  | "pageTransition"
  | "surfaceHover"
  | "listReveal";

export interface MotionConfig {
  intensity: MotionIntensity;
  features: Record<MotionFeature, boolean>;
  duration: {
    page: number;
    surface: number;
    ripple: number;
    reveal: number;
  };
  easing: {
    standard: string;
    entrance: string;
    entranceCurve: [number, number, number, number];
  };
  spring: {
    stiffness: number;
    damping: number;
    mass: number;
  };
  stagger: {
    delay: number;
    maxItems: number;
  };
  surface: {
    hoverY: string;
    hoverScale: number;
    tapScale: number;
  };
  pointer: {
    size: string;
    opacity: number;
    lowPowerHardwareConcurrency: number;
  };
}

type MotionVariables = CSSProperties & Record<`--sea-motion-${string}`, string>;

export const FRONTEND_MOTION_CONFIG: MotionConfig = {
  intensity: "balanced",
  features: {
    pointerAura: true,
    clickRipple: true,
    pageTransition: true,
    surfaceHover: true,
    listReveal: true,
  },
  duration: {
    page: 140,
    surface: 220,
    ripple: 620,
    reveal: 280,
  },
  easing: {
    standard: "cubic-bezier(0.22, 1, 0.36, 1)",
    entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
    entranceCurve: [0.16, 1, 0.3, 1],
  },
  spring: {
    stiffness: 420,
    damping: 34,
    mass: 0.72,
  },
  stagger: {
    delay: 0.035,
    maxItems: 8,
  },
  surface: {
    hoverY: "-0.32rem",
    hoverScale: 1.012,
    tapScale: 0.985,
  },
  pointer: {
    size: "clamp(13rem, 22vw, 24rem)",
    opacity: 0.38,
    lowPowerHardwareConcurrency: 4,
  },
};

export const FRONTEND_MOTION_VARIABLES: MotionVariables = {
  "--sea-motion-page-duration": `${FRONTEND_MOTION_CONFIG.duration.page}ms`,
  "--sea-motion-surface-duration": `${FRONTEND_MOTION_CONFIG.duration.surface}ms`,
  "--sea-motion-ripple-duration": `${FRONTEND_MOTION_CONFIG.duration.ripple}ms`,
  "--sea-motion-reveal-duration": `${FRONTEND_MOTION_CONFIG.duration.reveal}ms`,
  "--sea-motion-stagger-delay": `${FRONTEND_MOTION_CONFIG.stagger.delay * 1000}ms`,
  "--sea-motion-ease-standard": FRONTEND_MOTION_CONFIG.easing.standard,
  "--sea-motion-ease-entrance": FRONTEND_MOTION_CONFIG.easing.entrance,
  "--sea-motion-surface-hover-y": FRONTEND_MOTION_CONFIG.surface.hoverY,
  "--sea-motion-surface-hover-scale": String(FRONTEND_MOTION_CONFIG.surface.hoverScale),
  "--sea-motion-surface-tap-scale": String(FRONTEND_MOTION_CONFIG.surface.tapScale),
  "--sea-motion-pointer-size": FRONTEND_MOTION_CONFIG.pointer.size,
  "--sea-motion-pointer-opacity": String(FRONTEND_MOTION_CONFIG.pointer.opacity),
};

export const shouldEnableFrontendMotion = (pathname: string): boolean =>
  Boolean(pathname) && !pathname.startsWith("/admin");
