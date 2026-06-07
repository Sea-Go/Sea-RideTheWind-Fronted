"use client";

import { CheckIcon, PaletteIcon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";

import {
  DEFAULT_PROFILE_THEME_ID,
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  type ProfileThemeId,
  profileThemeMap,
  type ProfileThemePreset,
  profileThemes,
  resolveProfileThemeId,
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
  const themeId = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      const handleThemeChange = () => onStoreChange();
      window.addEventListener("storage", handleThemeChange);
      window.addEventListener(PROFILE_THEME_EVENT_NAME, handleThemeChange);
      return () => {
        window.removeEventListener("storage", handleThemeChange);
        window.removeEventListener(PROFILE_THEME_EVENT_NAME, handleThemeChange);
      };
    },
    () => resolveProfileThemeId(window.localStorage.getItem(PROFILE_THEME_STORAGE_KEY)),
    () => DEFAULT_PROFILE_THEME_ID,
  );
  const setThemeId = useCallback((value: ProfileThemeId) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(PROFILE_THEME_STORAGE_KEY, value);
    window.dispatchEvent(
      new CustomEvent(PROFILE_THEME_EVENT_NAME, {
        detail: { themeId: value },
      }),
    );
  }, []);

  const theme = useMemo(() => profileThemeMap[themeId], [themeId]);

  return (
    <ProfileThemeContext.Provider value={{ themeId, setThemeId, theme }}>
      <div
        className={cn(
          "app-surface text-foreground relative overflow-hidden rounded-[2rem] transition-[background-color,border-color,color,box-shadow] duration-300",
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
    <section className={cn("app-surface-elevated space-y-4 rounded-[1.75rem] p-6", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="app-pill text-muted-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <PaletteIcon className="h-3.5 w-3.5" />
            个人中心主题
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">换一套你喜欢的配色</h2>
        </div>
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
                "app-surface-soft hover:-translate-y-0.5 hover:shadow-md",
                "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none",
                active && "border-primary ring-primary/15 shadow-md ring-2",
              )}
            >
              <div
                className="border-border/70 mb-4 h-20 rounded-[1.2rem] border shadow-sm"
                style={{ backgroundImage: theme.heroGradient }}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold tracking-tight">{theme.label}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "app-pill text-muted-foreground group-hover:border-primary/40",
                  )}
                >
                  <CheckIcon className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {theme.swatches.map((color) => (
                  <span
                    key={`${theme.id}-${color}`}
                    className="border-border/70 h-5 w-5 rounded-full border shadow-sm"
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
