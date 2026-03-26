"use client";

import { CheckIcon, PaletteIcon } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  DEFAULT_PROFILE_THEME_ID,
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  isProfileThemeId,
  profileThemeMap,
  profileThemes,
  type ProfileThemeId,
  type ProfileThemePreset,
} from "./profile-theme-config";

interface ProfileThemeContextValue {
  themeId: ProfileThemeId;
  setThemeId: (value: ProfileThemeId) => void;
  theme: ProfileThemePreset;
}

const ProfileThemeContext = createContext<ProfileThemeContextValue | null>(null);

const useProfileThemeContext = (): ProfileThemeContextValue => {
  const context = useContext(ProfileThemeContext);
  if (!context) {
    throw new Error("ProfileTheme components must be used within ProfileThemeShell.");
  }
  return context;
};

export const ProfileThemeShell = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const [themeId, setThemeId] = useState<ProfileThemeId>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_PROFILE_THEME_ID;
    }

    const storedTheme = window.localStorage.getItem(PROFILE_THEME_STORAGE_KEY);
    if (storedTheme && isProfileThemeId(storedTheme)) {
      return storedTheme;
    }

    return DEFAULT_PROFILE_THEME_ID;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(PROFILE_THEME_STORAGE_KEY, themeId);
    window.dispatchEvent(
      new CustomEvent(PROFILE_THEME_EVENT_NAME, {
        detail: { themeId },
      }),
    );
  }, [themeId]);

  const theme = useMemo(() => profileThemeMap[themeId], [themeId]);

  return (
    <ProfileThemeContext.Provider value={{ themeId, setThemeId, theme }}>
      <div
        className={cn(
          "border-border/70 bg-background text-foreground relative overflow-hidden rounded-[2rem] border shadow-xl transition-[background-color,border-color,color,box-shadow] duration-300",
          className,
        )}
        style={theme.style}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-95"
          style={{ backgroundImage: theme.heroGradient }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-10 -right-10 h-40 w-40 rounded-full blur-3xl"
          style={{ backgroundColor: theme.haloColor }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 -left-12 h-36 w-36 rounded-full blur-3xl"
          style={{ backgroundColor: theme.accentGlow }}
        />
        <div className="relative p-5 md:p-7 lg:p-8">{children}</div>
      </div>
    </ProfileThemeContext.Provider>
  );
};

export const ProfileThemePicker = ({ className }: { className?: string }) => {
  const { themeId, setThemeId } = useProfileThemeContext();

  return (
    <section
      className={cn(
        "border-border/80 bg-card/85 space-y-4 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="border-border/80 bg-background/80 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <PaletteIcon className="h-3.5 w-3.5" />
            个人中心主题
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">换一套你喜欢的配色</h2>
          <p className="text-muted-foreground text-sm leading-6">
            只作用于个人中心和它的子页面。当前支持蓝白、粉白、黑白和暖黄四种风格。
          </p>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-6">
          切换后会自动记住你的选择，下次进入个人中心也会保持同一套主题。
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {profileThemes.map((theme) => {
          const active = theme.id === themeId;

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              aria-pressed={active}
              className={cn(
                "group rounded-[1.5rem] border p-4 text-left transition-all duration-200",
                "border-border/70 bg-background/75 shadow-sm hover:-translate-y-0.5 hover:shadow-md",
                "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none",
                active && "border-primary ring-primary/15 shadow-md ring-2",
              )}
            >
              <div
                className="mb-4 h-20 rounded-[1.2rem] border border-white/40 shadow-sm"
                style={{ backgroundImage: theme.heroGradient }}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold tracking-tight">{theme.label}</p>
                  <p className="text-muted-foreground text-xs leading-5">{theme.description}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground group-hover:border-primary/40",
                  )}
                >
                  <CheckIcon className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {theme.swatches.map((color) => (
                  <span
                    key={`${theme.id}-${color}`}
                    className="h-5 w-5 rounded-full border border-white/70 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
