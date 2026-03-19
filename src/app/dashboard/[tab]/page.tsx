import { notFound } from "next/navigation";

import { CardList } from "@/app/dashboard/_components/CardList";
import { DashboardShell } from "@/app/dashboard/_components/DashboardShell";
import {
  DASHBOARD_TAB_LABEL_MAP,
  DASHBOARD_TAB_SLUG_SET,
  DASHBOARD_TABS,
  type DashboardTabSlug,
  DEFAULT_DASHBOARD_TAB,
} from "@/app/dashboard/_constants/tabs";

interface DashboardTabPageProps {
  params: Promise<{ tab: string }>;
  searchParams: Promise<{ q?: string }>;
}

export function generateStaticParams() {
  return DASHBOARD_TABS.map((tab) => ({ tab: tab.slug }));
}

export default async function DashboardTabPage({ params, searchParams }: DashboardTabPageProps) {
  const { tab } = await params;
  const { q } = await searchParams;

  if (!DASHBOARD_TAB_SLUG_SET.has(tab)) {
    notFound();
  }

  const tabSlug = tab as DashboardTabSlug;
  const query = typeof q === "string" ? q.trim() : "";

  return (
    <DashboardShell query={query}>
      {tabSlug === DEFAULT_DASHBOARD_TAB ? (
        <CardList query={query} />
      ) : (
        <p className="text-muted-foreground py-8 text-center">
          {DASHBOARD_TAB_LABEL_MAP[tabSlug]}
          {"\u9891\u9053\u6b63\u5728\u5efa\u8bbe\u4e2d"}
        </p>
      )}
    </DashboardShell>
  );
}
