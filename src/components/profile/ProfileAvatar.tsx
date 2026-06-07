import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

const sizeClassNameMap = {
  sm: "h-9 w-9 text-sm",
  md: "h-14 w-14 text-xl",
  lg: "h-20 w-20 text-2xl",
  xl: "h-24 w-24 text-3xl md:h-28 md:w-28 md:text-4xl",
} as const;

export type ProfileAvatarSize = keyof typeof sizeClassNameMap;

export const normalizeProfileAvatarUrl = (value: string | null | undefined): string => {
  const normalized = value?.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const getAvatarInitial = (username?: string | null, uid?: string | null): string => {
  const source = username?.trim() || uid?.trim() || "海";
  return Array.from(source)[0]?.toUpperCase() ?? "海";
};

export const ProfileAvatar = ({
  username,
  uid,
  avatarUrl,
  size = "lg",
  className,
}: {
  username?: string | null;
  uid?: string | null;
  avatarUrl?: string | null;
  size?: ProfileAvatarSize;
  className?: string;
}) => {
  const normalizedAvatarUrl = normalizeProfileAvatarUrl(avatarUrl);
  const initial = getAvatarInitial(username, uid);
  const style: CSSProperties = normalizedAvatarUrl
    ? {
        backgroundImage: `linear-gradient(135deg, color-mix(in oklab, var(--primary) 8%, transparent), color-mix(in oklab, var(--app-surface-elevated) 8%, transparent)), url(${JSON.stringify(normalizedAvatarUrl)})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : {};

  return (
    <div
      className={cn(
        "border-border/80 bg-primary/12 text-primary ring-border/70 relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border font-bold shadow-sm ring-4",
        "bg-[radial-gradient(circle_at_28%_22%,color-mix(in_oklab,var(--app-surface-elevated)_82%,transparent),transparent_34%),linear-gradient(135deg,color-mix(in_oklab,var(--primary)_20%,transparent),var(--app-media-surface))]",
        sizeClassNameMap[size],
        className,
      )}
      style={style}
      aria-label={`${username?.trim() || "用户"}的头像`}
    >
      {normalizedAvatarUrl ? null : <span>{initial}</span>}
    </div>
  );
};
