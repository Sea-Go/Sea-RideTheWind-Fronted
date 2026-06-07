import type { CSSProperties } from "react";

export const PROFILE_THEME_STORAGE_KEY = "sea.profile.theme";
export const PROFILE_THEME_EVENT_NAME = "sea:profile-theme-change";

export type ProfileThemeId = "ocean" | "bluePink" | "night" | "snowMountain";
type LegacyProfileThemeId = "blush" | "mono" | "sunny";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export interface ProfileThemePreset {
  id: ProfileThemeId;
  label: string;
  heroGradient: string;
  haloColor: string;
  accentGlow: string;
  swatches: string[];
  style: ThemeStyle;
}

const oceanThemeSurfaces: ThemeStyle = {
  "--app-body-background":
    "linear-gradient(90deg, rgba(255, 255, 255, 0.68) 0, rgba(255, 255, 255, 0) 42rem), radial-gradient(circle at 78% 12%, rgba(126, 198, 255, 0.18), transparent 24rem), linear-gradient(135deg, rgba(248, 252, 255, 0.96), rgba(239, 248, 255, 0.92))",
  "--app-surface": "rgba(255, 255, 255, 0.86)",
  "--app-surface-elevated": "rgba(255, 255, 255, 0.94)",
  "--app-surface-muted": "rgba(232, 244, 255, 0.72)",
  "--app-surface-soft": "rgba(241, 248, 255, 0.66)",
  "--app-hero-surface":
    "linear-gradient(135deg, rgba(248, 252, 255, 0.98), rgba(232, 244, 255, 0.92))",
  "--app-pill-surface": "rgba(255, 255, 255, 0.82)",
  "--app-empty-surface": "rgba(232, 244, 255, 0.7)",
  "--app-media-surface": "rgba(232, 244, 255, 0.78)",
  "--app-input-surface": "rgba(255, 255, 255, 0.78)",
  "--app-input-focus-surface": "rgba(255, 255, 255, 0.94)",
  "--app-editor-surface": "rgba(255, 255, 255, 0.88)",
  "--app-editor-toolbar-surface": "rgba(228, 241, 255, 0.82)",
  "--app-code-surface": "rgba(228, 241, 255, 0.86)",
  "--app-danger-surface": "rgba(255, 241, 242, 0.88)",
  "--app-warning-surface": "rgba(255, 247, 237, 0.88)",
};

const bluePinkThemeSurfaces: ThemeStyle = {
  "--app-body-background":
    "radial-gradient(circle at 82% 8%, rgba(244, 114, 182, 0.12), transparent 28rem), radial-gradient(circle at 18% 0%, rgba(96, 165, 250, 0.14), transparent 28rem), linear-gradient(135deg, rgba(255, 245, 251, 0.96), rgba(239, 246, 255, 0.9))",
  "--app-surface": "rgba(255, 248, 252, 0.86)",
  "--app-surface-elevated": "rgba(255, 255, 255, 0.94)",
  "--app-surface-muted": "rgba(255, 228, 241, 0.7)",
  "--app-surface-soft": "rgba(239, 246, 255, 0.64)",
  "--app-hero-surface":
    "linear-gradient(135deg, rgba(255, 245, 251, 0.96), rgba(239, 246, 255, 0.9) 56%, rgba(255, 228, 241, 0.72))",
  "--app-pill-surface": "rgba(255, 255, 255, 0.82)",
  "--app-empty-surface": "rgba(255, 228, 241, 0.62)",
  "--app-media-surface": "rgba(245, 234, 250, 0.78)",
  "--app-input-surface": "rgba(255, 255, 255, 0.78)",
  "--app-input-focus-surface": "rgba(255, 255, 255, 0.95)",
  "--app-editor-surface": "rgba(255, 248, 252, 0.9)",
  "--app-editor-toolbar-surface": "rgba(255, 228, 241, 0.72)",
  "--app-code-surface": "rgba(219, 234, 254, 0.82)",
  "--app-danger-surface": "rgba(255, 241, 248, 0.9)",
  "--app-warning-surface": "rgba(255, 247, 237, 0.88)",
};

const nightThemeSurfaces: ThemeStyle = {
  "--app-body-background":
    "radial-gradient(circle at 82% 8%, rgba(96, 165, 250, 0.12), transparent 28rem), radial-gradient(circle at 18% 0%, rgba(168, 85, 247, 0.1), transparent 26rem), linear-gradient(135deg, rgba(9, 17, 31, 0.99), rgba(15, 23, 42, 0.98))",
  "--app-surface": "rgba(16, 26, 43, 0.86)",
  "--app-surface-elevated": "rgba(18, 29, 48, 0.95)",
  "--app-surface-muted": "rgba(23, 34, 54, 0.82)",
  "--app-surface-soft": "rgba(31, 44, 68, 0.58)",
  "--app-hero-surface":
    "linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(17, 31, 54, 0.92) 58%, rgba(30, 41, 59, 0.84))",
  "--app-pill-surface": "rgba(31, 44, 68, 0.78)",
  "--app-empty-surface": "rgba(23, 34, 54, 0.72)",
  "--app-media-surface": "rgba(15, 23, 42, 0.82)",
  "--app-input-surface": "rgba(18, 29, 48, 0.86)",
  "--app-input-focus-surface": "rgba(23, 34, 54, 0.96)",
  "--app-editor-surface": "rgba(16, 26, 43, 0.94)",
  "--app-editor-toolbar-surface": "rgba(23, 34, 54, 0.9)",
  "--app-code-surface": "rgba(7, 17, 31, 0.9)",
  "--app-danger-surface": "rgba(127, 29, 49, 0.28)",
  "--app-warning-surface": "rgba(120, 53, 15, 0.28)",
};

const snowMountainThemeSurfaces: ThemeStyle = {
  "--app-body-background":
    "linear-gradient(145deg, transparent 0 48%, rgba(148, 163, 184, 0.18) 48% 50%, transparent 50%), radial-gradient(circle at 82% 8%, rgba(186, 230, 253, 0.28), transparent 30rem), linear-gradient(135deg, rgba(248, 251, 255, 0.96), rgba(219, 234, 254, 0.86))",
  "--app-surface": "rgba(251, 253, 255, 0.88)",
  "--app-surface-elevated": "rgba(255, 255, 255, 0.96)",
  "--app-surface-muted": "rgba(219, 234, 254, 0.72)",
  "--app-surface-soft": "rgba(241, 247, 255, 0.72)",
  "--app-hero-surface":
    "linear-gradient(128deg, rgba(248, 251, 255, 0.96), rgba(219, 234, 254, 0.78) 62%, rgba(125, 178, 232, 0.22))",
  "--app-pill-surface": "rgba(251, 253, 255, 0.86)",
  "--app-empty-surface": "rgba(219, 234, 254, 0.64)",
  "--app-media-surface": "rgba(231, 240, 250, 0.8)",
  "--app-input-surface": "rgba(251, 253, 255, 0.82)",
  "--app-input-focus-surface": "rgba(255, 255, 255, 0.96)",
  "--app-editor-surface": "rgba(251, 253, 255, 0.9)",
  "--app-editor-toolbar-surface": "rgba(219, 234, 254, 0.78)",
  "--app-code-surface": "rgba(241, 247, 255, 0.9)",
  "--app-danger-surface": "rgba(255, 241, 242, 0.9)",
  "--app-warning-surface": "rgba(255, 247, 237, 0.9)",
};

export const profileThemes: ProfileThemePreset[] = [
  {
    id: "ocean",
    label: "蓝白",
    heroGradient: "linear-gradient(135deg, rgba(27, 111, 197, 0.22), rgba(239, 248, 255, 0.92))",
    haloColor: "rgba(64, 155, 255, 0.26)",
    accentGlow: "rgba(147, 197, 253, 0.3)",
    swatches: ["#1f6fbf", "#ecf6ff", "#ffffff", "#bfd9f5"],
    style: {
      ...oceanThemeSurfaces,
      "--background": "#f4f9ff",
      "--foreground": "#153149",
      "--card": "#ffffff",
      "--card-foreground": "#153149",
      "--popover": "#ffffff",
      "--popover-foreground": "#153149",
      "--primary": "#2176c9",
      "--primary-foreground": "#f8fcff",
      "--secondary": "#dceeff",
      "--secondary-foreground": "#174b80",
      "--muted": "#eaf4ff",
      "--muted-foreground": "#607b95",
      "--accent": "#e4f1ff",
      "--accent-foreground": "#17456e",
      "--destructive": "#d44561",
      "--destructive-foreground": "#fff8f8",
      "--border": "#c4d9ef",
      "--input": "#cdddf0",
      "--ring": "#2176c9",
      "--app-page-overlay":
        "radial-gradient(circle at 82% 6%, rgba(96, 165, 250, 0.18), transparent 30rem), radial-gradient(circle at 18% 0%, rgba(219, 242, 255, 0.55), transparent 28rem)",
      "--app-header-background": "rgba(255, 255, 255, 0.8)",
      "--app-menu-background": "rgba(255, 255, 255, 0.9)",
      "--app-sidebar-background":
        "linear-gradient(180deg, rgba(246, 251, 255, 0.96), rgba(232, 244, 255, 0.88))",
      "--app-footer-background":
        "linear-gradient(180deg, rgba(245, 250, 255, 0.5), rgba(236, 246, 255, 0.9))",
      "--app-search-hero-overlay":
        "linear-gradient(90deg, rgba(240, 249, 255, 0.98) 0%, rgba(232, 246, 255, 0.9) 42%, rgba(222, 244, 255, 0.74) 68%, rgba(224, 242, 254, 0.86) 100%)",
    },
  },
  {
    id: "bluePink",
    label: "蓝粉白",
    heroGradient:
      "radial-gradient(circle at 18% 18%, rgba(255, 132, 188, 0.34), transparent 24rem), linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(255, 241, 248, 0.96) 62%, rgba(255, 255, 255, 0.98))",
    haloColor: "rgba(244, 114, 182, 0.28)",
    accentGlow: "rgba(96, 165, 250, 0.3)",
    swatches: ["#2563eb", "#f472b6", "#fff1f8", "#ffffff"],
    style: {
      ...bluePinkThemeSurfaces,
      "--background": "#fff5fb",
      "--foreground": "#24304d",
      "--card": "#ffffff",
      "--card-foreground": "#24304d",
      "--popover": "#ffffff",
      "--popover-foreground": "#24304d",
      "--primary": "#2563eb",
      "--primary-foreground": "#f8fbff",
      "--secondary": "#ffe4f1",
      "--secondary-foreground": "#9d174d",
      "--muted": "#f5eafa",
      "--muted-foreground": "#74627a",
      "--accent": "#dbeafe",
      "--accent-foreground": "#1d4ed8",
      "--destructive": "#d6336c",
      "--destructive-foreground": "#fff8fb",
      "--border": "#f0b7d4",
      "--input": "#edc3da",
      "--ring": "#ec4899",
      "--app-page-overlay":
        "radial-gradient(circle at 82% 8%, rgba(244, 114, 182, 0.2), transparent 28rem), radial-gradient(circle at 18% 0%, rgba(96, 165, 250, 0.24), transparent 28rem)",
      "--app-header-background": "rgba(255, 245, 251, 0.86)",
      "--app-menu-background": "rgba(255, 248, 252, 0.92)",
      "--app-sidebar-background":
        "linear-gradient(180deg, rgba(255, 248, 252, 0.96), rgba(219, 234, 254, 0.9))",
      "--app-footer-background":
        "linear-gradient(180deg, rgba(255, 241, 248, 0.56), rgba(219, 234, 254, 0.72))",
      "--app-search-hero-overlay":
        "linear-gradient(90deg, rgba(255, 245, 251, 0.96) 0%, rgba(239, 246, 255, 0.9) 46%, rgba(255, 228, 241, 0.72) 100%)",
    },
  },
  {
    id: "night",
    label: "夜间模式",
    heroGradient:
      "radial-gradient(circle at 20% 18%, rgba(96, 165, 250, 0.22), transparent 25rem), radial-gradient(circle at 88% 10%, rgba(168, 85, 247, 0.2), transparent 22rem), linear-gradient(135deg, rgba(9, 17, 31, 0.96), rgba(15, 23, 42, 0.98) 58%, rgba(24, 32, 54, 0.96))",
    haloColor: "rgba(96, 165, 250, 0.22)",
    accentGlow: "rgba(168, 85, 247, 0.18)",
    swatches: ["#0f172a", "#60a5fa", "#a78bfa", "#e5edf8"],
    style: {
      ...nightThemeSurfaces,
      "--background": "#09111f",
      "--foreground": "#e5edf8",
      "--card": "#101a2b",
      "--card-foreground": "#e8f1ff",
      "--popover": "#121d30",
      "--popover-foreground": "#e8f1ff",
      "--primary": "#60a5fa",
      "--primary-foreground": "#07111f",
      "--secondary": "#1f2c44",
      "--secondary-foreground": "#dbeafe",
      "--muted": "#172236",
      "--muted-foreground": "#9fb1cb",
      "--accent": "#253554",
      "--accent-foreground": "#bfdbfe",
      "--destructive": "#fb7185",
      "--destructive-foreground": "#fff1f2",
      "--border": "#2b3a55",
      "--input": "#31425f",
      "--ring": "#93c5fd",
      "--app-page-overlay":
        "radial-gradient(circle at 82% 8%, rgba(96, 165, 250, 0.16), transparent 28rem), radial-gradient(circle at 18% 0%, rgba(168, 85, 247, 0.14), transparent 26rem)",
      "--app-header-background": "rgba(16, 26, 43, 0.88)",
      "--app-menu-background": "rgba(16, 26, 43, 0.94)",
      "--app-sidebar-background":
        "linear-gradient(180deg, rgba(16, 26, 43, 0.96), rgba(9, 17, 31, 0.94))",
      "--app-footer-background":
        "linear-gradient(180deg, rgba(16, 26, 43, 0.6), rgba(9, 17, 31, 0.92))",
      "--app-search-hero-overlay":
        "linear-gradient(90deg, rgba(9, 17, 31, 0.96) 0%, rgba(15, 23, 42, 0.9) 46%, rgba(30, 41, 59, 0.78) 100%)",
    },
  },
  {
    id: "snowMountain",
    label: "雪山背景",
    heroGradient:
      "linear-gradient(150deg, transparent 0 48%, rgba(148, 163, 184, 0.28) 48% 50%, transparent 50%), linear-gradient(128deg, rgba(255, 255, 255, 0.92) 0 34%, rgba(219, 234, 254, 0.74) 34% 52%, rgba(125, 178, 232, 0.2) 52% 100%), radial-gradient(circle at 72% 10%, rgba(186, 230, 253, 0.42), transparent 22rem)",
    haloColor: "rgba(186, 230, 253, 0.36)",
    accentGlow: "rgba(203, 213, 225, 0.34)",
    swatches: ["#1d5f99", "#dbeafe", "#f8fbff", "#94a3b8"],
    style: {
      ...snowMountainThemeSurfaces,
      "--background": "#eef6ff",
      "--foreground": "#17324a",
      "--card": "#fbfdff",
      "--card-foreground": "#17324a",
      "--popover": "#fbfdff",
      "--popover-foreground": "#17324a",
      "--primary": "#1d5f99",
      "--primary-foreground": "#f8fbff",
      "--secondary": "#dbeafe",
      "--secondary-foreground": "#1e4f7a",
      "--muted": "#e7f0fa",
      "--muted-foreground": "#61758a",
      "--accent": "#f1f7ff",
      "--accent-foreground": "#24577f",
      "--destructive": "#cf3f5c",
      "--destructive-foreground": "#fff8f8",
      "--border": "#bfd3e8",
      "--input": "#c7d8e8",
      "--ring": "#3b82c4",
      "--app-page-overlay":
        "linear-gradient(145deg, transparent 0 48%, rgba(148, 163, 184, 0.2) 48% 50%, transparent 50%), radial-gradient(circle at 82% 8%, rgba(186, 230, 253, 0.32), transparent 30rem), radial-gradient(circle at 18% 0%, rgba(248, 251, 255, 0.82), transparent 26rem)",
      "--app-header-background": "rgba(248, 251, 255, 0.86)",
      "--app-menu-background": "rgba(251, 253, 255, 0.94)",
      "--app-sidebar-background":
        "linear-gradient(180deg, rgba(251, 253, 255, 0.96), rgba(219, 234, 254, 0.88))",
      "--app-footer-background":
        "linear-gradient(180deg, rgba(248, 251, 255, 0.62), rgba(219, 234, 254, 0.82))",
      "--app-search-hero-overlay":
        "linear-gradient(90deg, rgba(248, 251, 255, 0.97) 0%, rgba(239, 246, 255, 0.9) 46%, rgba(219, 234, 254, 0.78) 100%)",
    },
  },
];

const legacyProfileThemeMap: Record<LegacyProfileThemeId, ProfileThemeId> = {
  blush: "bluePink",
  mono: "night",
  sunny: "snowMountain",
};

export const profileThemeMap = Object.fromEntries(
  profileThemes.map((theme) => [theme.id, theme]),
) as Record<ProfileThemeId, ProfileThemePreset>;

export const DEFAULT_PROFILE_THEME_ID: ProfileThemeId = "ocean";

export const isProfileThemeId = (value: string): value is ProfileThemeId =>
  value in profileThemeMap;

const isLegacyProfileThemeId = (value: string): value is LegacyProfileThemeId =>
  value in legacyProfileThemeMap;

export const resolveProfileThemeId = (value: string | null | undefined): ProfileThemeId => {
  if (!value) {
    return DEFAULT_PROFILE_THEME_ID;
  }

  if (isProfileThemeId(value)) {
    return value;
  }

  if (isLegacyProfileThemeId(value)) {
    return legacyProfileThemeMap[value];
  }

  return DEFAULT_PROFILE_THEME_ID;
};

export const shouldApplyFrontendTheme = (pathname: string): boolean => Boolean(pathname);
