import type { ReactNode } from "react";

import { SeaShell } from "./components/SeaShell";
import type { Theme } from "./data/types";
export type SeaSearchParams = Promise<Record<string, string | string[] | undefined>>;
export async function SeaRoute({
  searchParams,
  children,
}: {
  searchParams: SeaSearchParams;
  children: ReactNode;
}) {
  const q = await searchParams;
  const demo = q.demo === "1" && process.env.SEA_ENABLE_DEMO === "1";
  const theme: Theme = q.theme === "summer" || q.theme === "planetarium" ? q.theme : "mountain";
  return (
    <SeaShell initialDemo={demo} initialTheme={theme}>
      {children}
    </SeaShell>
  );
}
