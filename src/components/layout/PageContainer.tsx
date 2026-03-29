import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export const PageContainer = ({ children, className }: PageContainerProps) => {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-screen-2xl px-4 sm:px-5 lg:px-8", className)}>
      {children}
    </div>
  );
};
