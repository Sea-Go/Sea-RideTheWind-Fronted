"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type InteractiveSurfaceVariant = "card" | "button" | "nav" | "subtle";

const variantClassName: Record<InteractiveSurfaceVariant, string> = {
  card: "sea-interactive-surface sea-interactive-card",
  button: "sea-interactive-surface sea-interactive-button",
  nav: "sea-interactive-surface sea-interactive-nav",
  subtle: "sea-interactive-surface sea-interactive-subtle",
};

interface InteractiveSurfaceProps extends ComponentPropsWithoutRef<"div"> {
  asChild?: boolean;
  variant?: InteractiveSurfaceVariant;
  disabled?: boolean;
  children: ReactNode;
}

export const InteractiveSurface = ({
  asChild = false,
  variant = "card",
  disabled = false,
  className,
  children,
  ...props
}: InteractiveSurfaceProps) => {
  const Component = asChild ? Slot : "div";

  return (
    <Component
      data-motion-surface={disabled ? "disabled" : variant}
      className={cn(!disabled && variantClassName[variant], className)}
      {...props}
    >
      {children}
    </Component>
  );
};
