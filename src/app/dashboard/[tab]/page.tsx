import { notFound } from "next/navigation";

import { normalizeDashboardSearchMode } from "@/app/dashboard/_constants/search-mode";
import { CardList } from "@/app/dashboard/_components/CardList";
import { DashboardShell } from "@/app/dashboard/_components/DashboardShell";
import {
  DASHBOARD_TAB_SLUG_SET,
  DASHBOARD_TABS,
  type DashboardTabSlug,
} from "@/app/dashboard/_constants/tabs";
import { HotRankingBoard } from "@/components/hot/HotRankingBoard";

interface DashboardTabPageProps {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ q?: string; mode?: string }>;
}

export function generateStaticParams() {
  return DASHBOARD_TABS.map((tab) => ({ tab: tab.slug }));
}

export default async function DashboardTabPage({ params, searchParams }: DashboardTabPageProps) {
  const { tab } = await params;
  const { q, mode } = await searchParams;

  if (!DASHBOARD_TAB_SLUG_SET.has(tab)) {
    notFound();
  }

  const tabSlug = tab as DashboardTabSlug;
  const query = typeof q === "string" ? q.trim() : "";
  const searchMode = normalizeDashboardSearchMode(mode);

  return (
    <DashboardShell query={query} mode={searchMode}>
      {tabSlug === "hot" ? (
        <HotRankingBoard embedded />
      ) : (
        <CardList query={query} tabSlug={tabSlug} mode={searchMode} />
      )}
    </DashboardShell>
  );
}
