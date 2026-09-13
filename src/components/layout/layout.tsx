"use client";
import type { ReactNode } from "react";

import { SeaShell } from "@/features/sea/components/SeaShell";
interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  mainClassName?: string;
}
// Existing article, author, comment, favorite, follow, profile, editor and travel components retain their API logic.
export const Layout = ({ children, mainClassName, hideFooter = false }: LayoutProps) => (
  <SeaShell legacy mainClassName={mainClassName} hideFooter={hideFooter}>
    {children}
  </SeaShell>
);
