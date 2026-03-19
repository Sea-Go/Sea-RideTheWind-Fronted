import { redirect } from "next/navigation";

import { DEFAULT_DASHBOARD_TAB } from "@/app/dashboard/_constants/tabs";

interface DashboardPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const queryString = query ? `?q=${encodeURIComponent(query)}` : "";

  redirect(`/dashboard/${DEFAULT_DASHBOARD_TAB}${queryString}`);
}
