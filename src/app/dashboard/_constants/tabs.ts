// Dashboard 子频道路由配置，统一维护 slug 与展示文案。

export const DASHBOARD_TABS = [
  { slug: "recommend", label: "推荐" },
  { slug: "outfit", label: "穿搭" },
  { slug: "food", label: "美食" },
  { slug: "beauty", label: "美妆" },
  { slug: "movie", label: "影视" },
  { slug: "career", label: "职场" },
  { slug: "emotion", label: "情感" },
  { slug: "home", label: "家居" },
  { slug: "game", label: "游戏" },
  { slug: "travel", label: "旅行" },
  { slug: "fitness", label: "健身" },
] as const;

export type DashboardTabSlug = (typeof DASHBOARD_TABS)[number]["slug"];

export const DEFAULT_DASHBOARD_TAB: DashboardTabSlug = "recommend";

export const DASHBOARD_TAB_SLUG_SET = new Set<string>(DASHBOARD_TABS.map((tab) => tab.slug));

export const DASHBOARD_TAB_LABEL_MAP = Object.fromEntries(
  DASHBOARD_TABS.map((tab) => [tab.slug, tab.label]),
) as Record<DashboardTabSlug, string>;
