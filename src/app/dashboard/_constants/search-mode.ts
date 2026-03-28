import type { DashboardSearchMode } from "@/types";

export const DEFAULT_DASHBOARD_SEARCH_MODE: DashboardSearchMode = "content";

export const DASHBOARD_SEARCH_MODE_OPTIONS: ReadonlyArray<{
  value: DashboardSearchMode;
  label: string;
}> = [
  { value: "content", label: "内容搜索" },
  { value: "title", label: "标题搜索" },
  { value: "author", label: "作者名字搜索" },
];

const DASHBOARD_SEARCH_MODE_SET = new Set<DashboardSearchMode>(
  DASHBOARD_SEARCH_MODE_OPTIONS.map((option) => option.value),
);

export const normalizeDashboardSearchMode = (
  value: string | null | undefined,
): DashboardSearchMode => {
  if (!value) {
    return DEFAULT_DASHBOARD_SEARCH_MODE;
  }

  return DASHBOARD_SEARCH_MODE_SET.has(value as DashboardSearchMode)
    ? (value as DashboardSearchMode)
    : DEFAULT_DASHBOARD_SEARCH_MODE;
};
