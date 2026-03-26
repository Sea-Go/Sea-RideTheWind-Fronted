import type { CSSProperties } from "react";

export const PROFILE_THEME_STORAGE_KEY = "sea.profile.theme";
export const PROFILE_THEME_EVENT_NAME = "sea:profile-theme-change";

export type ProfileThemeId = "ocean" | "blush" | "mono" | "sunny";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export interface ProfileThemePreset {
  id: ProfileThemeId;
  label: string;
  description: string;
  heroGradient: string;
  haloColor: string;
  accentGlow: string;
  swatches: string[];
  style: ThemeStyle;
}

export const profileThemes: ProfileThemePreset[] = [
  {
    id: "ocean",
    label: "蓝白",
    description: "清爽、安静，适合常驻阅读。",
    heroGradient: "linear-gradient(135deg, rgba(27, 111, 197, 0.22), rgba(239, 248, 255, 0.92))",
    haloColor: "rgba(64, 155, 255, 0.26)",
    accentGlow: "rgba(147, 197, 253, 0.3)",
    swatches: ["#1f6fbf", "#ecf6ff", "#ffffff", "#bfd9f5"],
    style: {
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
    },
  },
  {
    id: "blush",
    label: "粉白",
    description: "柔和明亮，带一点轻甜感。",
    heroGradient: "linear-gradient(135deg, rgba(231, 84, 146, 0.2), rgba(255, 246, 251, 0.96) 68%)",
    haloColor: "rgba(244, 114, 182, 0.28)",
    accentGlow: "rgba(251, 207, 232, 0.34)",
    swatches: ["#de5f95", "#fff0f7", "#ffffff", "#f5cadc"],
    style: {
      "--background": "#fff7fb",
      "--foreground": "#4f2839",
      "--card": "#ffffff",
      "--card-foreground": "#4f2839",
      "--popover": "#ffffff",
      "--popover-foreground": "#4f2839",
      "--primary": "#db5b93",
      "--primary-foreground": "#fff8fb",
      "--secondary": "#ffddeb",
      "--secondary-foreground": "#7d3557",
      "--muted": "#fff0f6",
      "--muted-foreground": "#8e6077",
      "--accent": "#ffe5f0",
      "--accent-foreground": "#622f46",
      "--destructive": "#ce4965",
      "--destructive-foreground": "#fff8f8",
      "--border": "#f0cddd",
      "--input": "#f3d6e2",
      "--ring": "#db5b93",
    },
  },
  {
    id: "mono",
    label: "黑白",
    description: "高对比度，利落克制。",
    heroGradient: "linear-gradient(135deg, rgba(17, 17, 17, 0.18), rgba(255, 255, 255, 0.97))",
    haloColor: "rgba(30, 30, 30, 0.18)",
    accentGlow: "rgba(148, 163, 184, 0.28)",
    swatches: ["#111111", "#f3f3f3", "#ffffff", "#d4d4d4"],
    style: {
      "--background": "#f5f5f5",
      "--foreground": "#111111",
      "--card": "#ffffff",
      "--card-foreground": "#111111",
      "--popover": "#ffffff",
      "--popover-foreground": "#111111",
      "--primary": "#111111",
      "--primary-foreground": "#fafafa",
      "--secondary": "#e5e5e5",
      "--secondary-foreground": "#161616",
      "--muted": "#ececec",
      "--muted-foreground": "#616161",
      "--accent": "#dedede",
      "--accent-foreground": "#171717",
      "--destructive": "#b73737",
      "--destructive-foreground": "#fff8f8",
      "--border": "#d0d0d0",
      "--input": "#d8d8d8",
      "--ring": "#111111",
    },
  },
  {
    id: "sunny",
    label: "黄底",
    description: "暖黄纸张感，适合轻松浏览。",
    heroGradient:
      "linear-gradient(135deg, rgba(237, 176, 35, 0.28), rgba(255, 252, 238, 0.98) 72%)",
    haloColor: "rgba(245, 183, 55, 0.26)",
    accentGlow: "rgba(253, 224, 120, 0.34)",
    swatches: ["#c98200", "#fff5bf", "#fffdf2", "#ecd38d"],
    style: {
      "--background": "#fff7da",
      "--foreground": "#4e3813",
      "--card": "#fffdf3",
      "--card-foreground": "#4e3813",
      "--popover": "#fffdf3",
      "--popover-foreground": "#4e3813",
      "--primary": "#c68708",
      "--primary-foreground": "#fffdf7",
      "--secondary": "#ffe8a6",
      "--secondary-foreground": "#6c4b07",
      "--muted": "#fff0bc",
      "--muted-foreground": "#8a6a28",
      "--accent": "#ffedb1",
      "--accent-foreground": "#5e4306",
      "--destructive": "#c9511f",
      "--destructive-foreground": "#fff7f1",
      "--border": "#e9d089",
      "--input": "#efd99b",
      "--ring": "#c68708",
    },
  },
];

export const profileThemeMap = Object.fromEntries(
  profileThemes.map((theme) => [theme.id, theme]),
) as Record<ProfileThemeId, ProfileThemePreset>;

export const DEFAULT_PROFILE_THEME_ID: ProfileThemeId = "ocean";

export const isProfileThemeId = (value: string): value is ProfileThemeId =>
  value in profileThemeMap;

export const resolveProfileThemeId = (value: string | null | undefined): ProfileThemeId =>
  value && isProfileThemeId(value) ? value : DEFAULT_PROFILE_THEME_ID;

export const shouldApplyFrontendTheme = (pathname: string): boolean =>
  Boolean(pathname) && !pathname.startsWith("/admin");
