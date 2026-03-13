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
}

export function generateStaticParams() {
  return DASHBOARD_TABS.map((tab) => ({ tab: tab.slug }));
}

export default async function DashboardTabPage({ params }: DashboardTabPageProps) {
  const { tab } = await params;

  if (!DASHBOARD_TAB_SLUG_SET.has(tab)) {
    notFound();
  }

  const tabSlug = tab as DashboardTabSlug;

  return (
    <DashboardShell>
      {tabSlug === DEFAULT_DASHBOARD_TAB ? (
        <CardList />
      ) : (
        <p className="text-muted-foreground py-8 text-center">
          {DASHBOARD_TAB_LABEL_MAP[tabSlug]}频道正在建设中
        </p>
      )}
    </DashboardShell>
  );
}
