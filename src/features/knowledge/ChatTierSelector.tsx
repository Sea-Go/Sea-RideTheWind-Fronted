"use client";

import { type LucideIcon, MicroscopeIcon, ScaleIcon, ZapIcon } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  CHAT_TIER_DEFS,
  type ChatTier,
  type ChatTierDef,
  isChatTier,
} from "./generated/structureComponents";

const TIER_ICONS: Record<ChatTier, LucideIcon> = {
  fast: ZapIcon,
  balanced: ScaleIcon,
  deep: MicroscopeIcon,
};

interface ChatTierSelectorProps {
  /** 受控值（与 defaultValue 二选一；两者都传时受控优先）。 */
  value?: ChatTier;
  /** 非受控默认档；父层把冻结的默认档（D12）从这里传入。 */
  defaultValue?: ChatTier;
  onValueChange?: (tier: ChatTier) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * fast/balanced/deep 三档分段控件。视觉契约（前端视觉规范研究依据 §E）：
 * 容器 muted 底、active 段 primary 底，过渡 200ms，reduce-motion 直切。
 * 文案与档位字符串只消费 generated/structureComponents 的唯一来源。
 */
export const ChatTierSelector = ({
  value,
  defaultValue = "balanced",
  onValueChange,
  disabled = false,
  className,
}: ChatTierSelectorProps) => {
  const [internal, setInternal] = useState<ChatTier>(
    isChatTier(defaultValue) ? defaultValue : "balanced",
  );
  const active = value ?? internal;
  const radiosId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const select = (tier: ChatTier) => {
    if (disabled || tier === active) return;
    if (value === undefined) setInternal(tier);
    onValueChange?.(tier);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const currentIndex = CHAT_TIER_DEFS.findIndex((tier) => tier.id === active);
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = CHAT_TIER_DEFS[
      (currentIndex + delta + CHAT_TIER_DEFS.length) % CHAT_TIER_DEFS.length
    ] as ChatTierDef;
    select(next.id);
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[CHAT_TIER_DEFS.findIndex((tier) => tier.id === next.id)]?.focus();
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="问答档位"
      aria-disabled={disabled}
      onKeyDown={handleKeyDown}
      className={cn(
        "bg-muted text-foreground/80 border-border/70 grid gap-1 rounded-xl border p-1",
        "shadow-xs backdrop-blur-sm select-none",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
        {CHAT_TIER_DEFS.map((tier) => {
          const Icon = TIER_ICONS[tier.id];
          const isActive = tier.id === active;
          return (
            <button
              key={tier.id}
              type="button"
              role="radio"
              id={`${radiosId}-${tier.id}`}
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => select(tier.id)}
              className={cn(
                "group relative flex min-w-0 items-start gap-2.5 rounded-lg px-3 py-2.5 text-left",
                "motion-safe:transition-[background-color,color,box-shadow,transform] motion-safe:duration-200",
                "focus-visible:ring-ring focus-visible:ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:ease-out",
                isActive
                  ? "bg-primary text-primary-foreground shadow-primary/25 shadow-md sm:hover:-translate-y-px"
                  : "hover:bg-accent/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 motion-safe:transition-colors motion-safe:duration-200",
                  isActive ? "opacity-100" : "opacity-70",
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm leading-5 font-semibold">{tier.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-xs leading-4 motion-safe:transition-colors motion-safe:duration-200",
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground/90",
                  )}
                  title={tier.description}
                >
                  {tier.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
