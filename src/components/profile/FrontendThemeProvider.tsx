"use client";

import { type ReactNode, useMemo, useSyncExternalStore } from "react";

import {
  DEFAULT_PROFILE_THEME_ID,
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  profileThemeMap,
  resolveProfileThemeId,
} from "./profile-theme-config";

const subscribeProfileTheme = (onStoreChange: () => void): (() => void) => {
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
};

const getProfileThemeSnapshot = () => {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE_THEME_ID;
  }

  return resolveProfileThemeId(window.localStorage.getItem(PROFILE_THEME_STORAGE_KEY));
};

const getServerProfileThemeSnapshot = () => DEFAULT_PROFILE_THEME_ID;

export const FrontendThemeProvider = ({ children }: { children: ReactNode }) => {
  const themeId = useSyncExternalStore(
    subscribeProfileTheme,
    getProfileThemeSnapshot,
    getServerProfileThemeSnapshot,
  );
  const theme = useMemo(() => profileThemeMap[themeId], [themeId]);

  return (
    <div className="contents" style={theme.style}>
      {children}
    </div>
  );
};
