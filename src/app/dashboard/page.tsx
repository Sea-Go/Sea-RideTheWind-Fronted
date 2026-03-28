import { redirect } from "next/navigation";

import {
  DEFAULT_DASHBOARD_SEARCH_MODE,
  normalizeDashboardSearchMode,
} from "@/app/dashboard/_constants/search-mode";
import { DEFAULT_DASHBOARD_TAB } from "@/app/dashboard/_constants/tabs";

interface DashboardPageProps {
  searchParams: Promise<{ q?: string; mode?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { q, mode } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const searchMode = normalizeDashboardSearchMode(mode);
  const nextParams = new URLSearchParams();
  if (query) {
    nextParams.set("q", query);
  }
  if (searchMode !== DEFAULT_DASHBOARD_SEARCH_MODE) {
    nextParams.set("mode", searchMode);
  }

  const queryString = nextParams.toString();
  redirect(`/dashboard/${DEFAULT_DASHBOARD_TAB}${queryString ? `?${queryString}` : ""}`);
}
