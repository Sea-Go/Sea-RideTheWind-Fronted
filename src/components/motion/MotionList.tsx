"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MotionListProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  enabled?: boolean;
}

export const MotionList = ({
  children,
  className,
  enabled = true,
  ...props
}: MotionListProps) => (
  <div className={cn(enabled && "sea-motion-list", className)} {...props}>
    {children}
  </div>
);
