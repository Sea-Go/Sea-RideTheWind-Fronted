"use client";

import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  Clock3Icon,
  GaugeIcon,
  LineChartIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TablePropertiesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminPageContainer } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { buildLoginPath } from "@/lib/auth-entry";
import { cn } from "@/lib/utils";
import { getAdminAuthToken, syncAdminAuthCookieFromStorage } from "@/services/admin";
import {
  getRecoEvaluationSummary,
  type RecoEvaluationSummary,
  type RecoMetricValue,
} from "@/services/reco";

const SURFACE_OPTIONS = [
  { value: "dashboard_recommend", label: "首页推荐" },
  { value: "search_recommend", label: "搜索推荐" },
  { value: "detail_related", label: "详情相关推荐" },
];

const WINDOW_OPTIONS = [
  { value: "1h", label: "近 1 小时", grafanaFrom: "now-1h" },
  { value: "24h", label: "近 24 小时", grafanaFrom: "now-24h" },
  { value: "7d", label: "近 7 天", grafanaFrom: "now-7d" },
  { value: "30d", label: "近 30 天", grafanaFrom: "now-30d" },
];

const ENV_OPTIONS = ["prod", "staging", "dev"] as const;

const METRIC_DEFS: Array<Pick<RecoMetricValue, "key" | "label" | "category" | "description">> = [
  {
    key: "hit_rate",
    label: "命中率",
    category: "推荐效果指标",
    description: "推荐列表中是否包含用户感兴趣或符合需求的内容",
  },
  {
    key: "recall",
    label: "召回率",
    category: "推荐效果指标",
    description: "内容库中相关内容被系统找回的比例",
  },
  {
    key: "precision",
    label: "准确率",
    category: "推荐效果指标",
    description: "推荐结果中真正满足用户需求的内容比例",
  },
  {
    key: "ranking_quality",
    label: "排序质量",
    category: "推荐效果指标",
    description: "相关度更高的内容是否排在推荐列表前面",
  },
  {
    key: "diversity",
    label: "多样性",
    category: "推荐列表质量指标",
    description: "推荐结果是否涵盖不同主题、类型或方向",
  },
  {
    key: "coverage",
    label: "覆盖率",
    category: "推荐列表质量指标",
    description: "内容库中被推荐到的内容占整体内容库的比例",
  },
  {
    key: "personalization",
    label: "个性化程度",
    category: "个性化指标",
    description: "不同兴趣、不同历史行为用户是否得到差异化结果",
  },
  {
    key: "ctr",
    label: "点击率（CTR）",
    category: "用户行为指标",
    description: "推荐内容曝光后，用户点击的比例",
  },
  {
    key: "cvr",
    label: "转化率（CVR）",
    category: "用户行为指标",
    description: "用户点击后产生收藏、点赞、完整阅读等行为的比例",
  },
];

const CATEGORY_TONE: Record<string, string> = {
  推荐效果指标: "border-blue-200 bg-blue-50 text-blue-700",
  推荐列表质量指标: "border-emerald-200 bg-emerald-50 text-emerald-700",
  个性化指标: "border-violet-200 bg-violet-50 text-violet-700",
  用户行为指标: "border-amber-200 bg-amber-50 text-amber-700",
};

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const formatInteger = (value?: number): string =>
  new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value ?? 0)));

const clampMetric = (value?: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(1, value);
};

const formatSummaryError = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  if (!rawMessage || rawMessage === "404 page not found" || rawMessage.includes("路由不存在")) {
    return "推荐指标采集接口暂不可用，请确认 recommendation-service 已升级并重启";
  }
  return rawMessage;
};

const findMetric = (
  summary: RecoEvaluationSummary | null,
  key: string,
): RecoMetricValue | undefined => summary?.metric_values.find((item) => item.key === key);

function MetricBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-sky-500 transition-[width]"
        style={{ width: `${Math.round(clampMetric(value) * 100)}%` }}
      />
    </div>
  );
}

function SnapshotBars({ values }: { values: number[] }) {
  return (
    <div className="flex h-28 items-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="min-h-2 flex-1 rounded-t bg-sky-500"
          style={{ height: `${Math.max(8, clampMetric(value) * 96)}px` }}
        />
      ))}
    </div>
  );
}

export default function RecommendationMetricsPage() {
  const router = useRouter();
  const [surface, setSurface] = useState(SURFACE_OPTIONS[0].value);
  const [windowValue, setWindowValue] = useState(WINDOW_OPTIONS[1].value);
  const [environment, setEnvironment] = useState<(typeof ENV_OPTIONS)[number]>("prod");
  const [summary, setSummary] = useState<RecoEvaluationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    const token = syncAdminAuthCookieFromStorage() ?? getAdminAuthToken();
    if (!token) {
      router.replace(buildLoginPath({ role: "admin", next: "/admin/recommendation-metrics" }));
      setIsLoading(false);
      return;
    }
    setIsAuthorized(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    let cancelled = false;
    const loadSummary = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await getRecoEvaluationSummary({ surface, window: windowValue });
        if (!cancelled) {
          setSummary(data);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(formatSummaryError(error));
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized, surface, windowValue, refreshTick]);

  const metricRows = useMemo(
    () =>
      METRIC_DEFS.map((def) => {
        const current = findMetric(summary, def.key);
        return {
          ...def,
          value: clampMetric(current?.value),
          source: current?.source ?? "online_implicit",
        };
      }),
    [summary],
  );

  const groupedMetrics = useMemo(() => {
    const groups = new Map<string, typeof metricRows>();
    for (const item of metricRows) {
      const current = groups.get(item.category) ?? [];
      current.push(item);
      groups.set(item.category, current);
    }
    return Array.from(groups.entries());
  }, [metricRows]);

  const selectedWindow =
    WINDOW_OPTIONS.find((item) => item.value === windowValue) ?? WINDOW_OPTIONS[1];
  const selectedSurface =
    SURFACE_OPTIONS.find((item) => item.value === surface) ?? SURFACE_OPTIONS[0];
  const iframeSrc = `/api/admin/grafana/d/recommendation-evaluation/recommendation-evaluation?orgId=1&from=${encodeURIComponent(
    selectedWindow.grafanaFrom,
  )}&to=now&var-surface=${encodeURIComponent(surface)}&var-window=${encodeURIComponent(
    windowValue,
  )}&var-env=${encodeURIComponent(environment)}&theme=light&kiosk=1`;

  useEffect(() => {
    setIframeLoaded(false);
    const timer = window.setTimeout(() => setIframeLoaded(true), 4000);
    return () => window.clearTimeout(timer);
  }, [iframeSrc]);

  const keyMetrics = ["hit_rate", "precision", "ranking_quality", "ctr"].map((key) => {
    const metric = metricRows.find((item) => item.key === key);
    return metric ?? metricRows[0];
  });

  const anomalyItems = metricRows
    .filter((item) => {
      if (summary?.request_count === 0) {
        return false;
      }
      if (item.key === "ctr") {
        return item.value < 0.03;
      }
      if (item.key === "cvr") {
        return item.value < 0.08;
      }
      return ["hit_rate", "precision", "ranking_quality"].includes(item.key) && item.value < 0.2;
    })
    .slice(0, 4);
  const isZeroSummary =
    !isLoading &&
    !!summary &&
    !summary.request_count &&
    !summary.impression_count &&
    !summary.click_count &&
    !summary.conversion_count;
  const isBehaviorDataEmpty =
    !isLoading &&
    !!summary &&
    !summary.impression_count &&
    !summary.click_count &&
    !summary.conversion_count;

  return (
    <AdminShell title="推荐指标" eyebrow="Observability" description="Grafana 推荐指标看板">
      <AdminPageContainer className="max-w-[100rem] space-y-4 py-4 sm:py-5">
        <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1">
                  <ShieldCheckIcon className="size-3.5 text-emerald-600" />
                  管理后台
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1">
                  <ActivityIcon className="size-3.5 text-sky-600" />
                  recommendation-service
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950">推荐指标观测台</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {ENV_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setEnvironment(item)}
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-semibold transition-colors",
                      environment === item
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-white",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <select
                value={surface}
                onChange={(event) => setSurface(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400"
                aria-label="推荐场景"
              >
                {SURFACE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {WINDOW_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setWindowValue(item.value)}
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-semibold transition-colors",
                      windowValue === item.value
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:bg-white/70",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setRefreshTick((value) => value + 1)}
                disabled={isLoading}
                aria-label="刷新"
                title="刷新"
                className="rounded-lg"
              >
                <RefreshCcwIcon className={cn("size-4", isLoading ? "animate-spin" : "")} />
              </Button>
            </div>
          </div>
        </header>

        {(isZeroSummary || isBehaviorDataEmpty) && (
          <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-sky-800">
                  {isZeroSummary ? "当前窗口暂无推荐行为数据" : "当前窗口缺少用户行为数据"}
                </p>
                <p className="mt-1 text-sm text-sky-700">
                  指标仅展示真实推荐请求和用户行为上报结果。请等待线上行为进入，或在验收环境通过用户区推荐、点击、收藏和完整阅读链路产生数据。
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BarChart3Icon className="size-4 text-sky-600" />
              Grafana 推荐指标看板
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1">
                <Clock3Icon className="size-3.5" />
                {summary?.generated_at
                  ? new Date(summary.generated_at).toLocaleString("zh-CN")
                  : "等待数据"}
              </span>
              <span
                className={cn(
                  "rounded border px-2 py-1",
                  iframeLoaded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500",
                )}
              >
                {iframeLoaded ? "已加载" : "加载中"}
              </span>
            </div>
          </div>
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title="推荐指标 Grafana 看板"
            className="h-[38rem] w-full border-0 bg-white md:h-[48rem]"
            onLoad={() => setIframeLoaded(true)}
          />
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {keyMetrics.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{item.category}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{item.label}</p>
                </div>
                <GaugeIcon className="size-4 text-sky-600" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-950">
                {formatPercent(item.value)}
              </p>
              <div className="mt-4">
                <MetricBar value={item.value} />
              </div>
            </div>
          ))}
        </section>

        <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <SlidersHorizontalIcon className="size-4 text-sky-600" />
                指标分组
              </div>
              <div className="space-y-3">
                {groupedMetrics.map(([category, items]) => (
                  <div key={category} className="rounded-lg border border-slate-200 p-3">
                    <span
                      className={cn(
                        "inline-flex rounded border px-2 py-1 text-xs font-semibold",
                        CATEGORY_TONE[category] ?? "border-slate-200 bg-slate-50 text-slate-700",
                      )}
                    >
                      {category}
                    </span>
                    <div className="mt-3 space-y-3">
                      {items.map((item) => (
                        <div key={item.key} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-700">{item.label}</span>
                            <span className="font-mono text-slate-500">
                              {formatPercent(item.value)}
                            </span>
                          </div>
                          <MetricBar value={item.value} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AlertTriangleIcon className="size-4 text-amber-600" />
                异常与告警
              </div>
              {errorMessage ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : anomalyItems.length ? (
                <div className="space-y-2">
                  {anomalyItems.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      <p className="font-semibold">{item.label} 偏低</p>
                      <p className="mt-1 text-xs">{formatPercent(item.value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  当前窗口暂无异常
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <LineChartIcon className="size-4 text-sky-600" />
                    趋势图
                  </div>
                  <span className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500">
                    {selectedSurface.label} · {selectedWindow.label}
                  </span>
                </div>
                <SnapshotBars values={metricRows.map((item) => item.value)} />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TablePropertiesIcon className="size-4 text-sky-600" />
                  明细
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">请求数</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {formatInteger(summary?.request_count)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">曝光数</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {formatInteger(summary?.impression_count)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">点击数</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {formatInteger(summary?.click_count)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">转化数</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {formatInteger(summary?.conversion_count)}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        </section>
      </AdminPageContainer>
    </AdminShell>
  );
}
