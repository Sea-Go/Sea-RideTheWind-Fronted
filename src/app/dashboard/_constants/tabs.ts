export const DASHBOARD_TABS = [
  { slug: "recommend", label: "\u63a8\u8350", searchTerms: [] },
  { slug: "hot", label: "\u70ed\u699c", searchTerms: [] },
  {
    slug: "outfit",
    label: "\u7a7f\u642d",
    searchTerms: ["\u7a7f\u642d", "\u642d\u914d", "look", "\u9020\u578b"],
  },
  {
    slug: "food",
    label: "\u7f8e\u98df",
    searchTerms: ["\u7f8e\u98df", "\u63a2\u5e97", "\u6599\u7406", "\u751c\u54c1"],
  },
  {
    slug: "beauty",
    label: "\u7f8e\u5986",
    searchTerms: ["\u7f8e\u5986", "\u62a4\u80a4", "\u5986\u5bb9", "\u53d8\u7f8e"],
  },
  {
    slug: "movie",
    label: "\u5f71\u89c6",
    searchTerms: ["\u5f71\u89c6", "\u7535\u5f71", "\u5267\u96c6", "\u5f71\u8bc4"],
  },
  {
    slug: "career",
    label: "\u804c\u573a",
    searchTerms: ["\u804c\u573a", "\u6c42\u804c", "\u9762\u8bd5", "\u6210\u957f"],
  },
  {
    slug: "emotion",
    label: "\u60c5\u611f",
    searchTerms: ["\u60c5\u611f", "\u5173\u7cfb", "\u604b\u7231", "\u6cbb\u6108"],
  },
  {
    slug: "home",
    label: "\u5bb6\u5c45",
    searchTerms: ["\u5bb6\u5c45", "\u88c5\u4fee", "\u6536\u7eb3", "\u751f\u6d3b\u65b9\u5f0f"],
  },
  {
    slug: "game",
    label: "\u6e38\u620f",
    searchTerms: ["\u6e38\u620f", "\u653b\u7565", "\u5f00\u9ed1", "\u7248\u672c"],
  },
  {
    slug: "travel",
    label: "\u65c5\u884c",
    searchTerms: ["\u65c5\u884c", "\u653b\u7565", "\u51fa\u884c", "\u76ee\u7684\u5730"],
  },
  {
    slug: "fitness",
    label: "\u5065\u8eab",
    searchTerms: ["\u5065\u8eab", "\u8fd0\u52a8", "\u51cf\u8102", "\u8bad\u7ec3"],
  },
] as const;

export type DashboardTabSlug = (typeof DASHBOARD_TABS)[number]["slug"];

export const DEFAULT_DASHBOARD_TAB: DashboardTabSlug = "recommend";

export const DASHBOARD_TAB_SLUG_SET = new Set<string>(DASHBOARD_TABS.map((tab) => tab.slug));

export const DASHBOARD_TAB_LABEL_MAP = Object.fromEntries(
  DASHBOARD_TABS.map((tab) => [tab.slug, tab.label]),
) as Record<DashboardTabSlug, string>;

export const DASHBOARD_TAB_SEARCH_TERMS_MAP = Object.fromEntries(
  DASHBOARD_TABS.map((tab) => [tab.slug, tab.searchTerms]),
) as unknown as Record<DashboardTabSlug, readonly string[]>;

export const buildDashboardTabSearchText = (tabSlug: DashboardTabSlug): string => {
  const tab = DASHBOARD_TABS.find((item) => item.slug === tabSlug);
  if (!tab || tab.slug === DEFAULT_DASHBOARD_TAB) {
    return "";
  }

  return [tab.label, ...tab.searchTerms].filter(Boolean).join(" ");
};
