import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export const PageContainer = ({ children, className }: PageContainerProps) => {
  return (
    <div className={cn("mx-auto w-full max-w-[92rem] min-w-0 px-4 sm:px-6 lg:px-10", className)}>
      {children}
    </div>
  );
};
