"use client";

import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  GitBranchIcon,
  LineChartIcon,
  PercentIcon,
  TablePropertiesIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminKpiCard, AdminPageContainer, AdminPanel } from "@/components/admin/AdminPanel";
import {
  ADMIN_WINDOW_OPTIONS,
  type AdminEnvironment,
  AdminShell,
  type AdminSurfaceValue,
  type AdminWindowValue,
} from "@/components/admin/AdminShell";
import {
  compactTraceId,
  formatTraceDuration,
  formatTraceStartTime,
  mergeTraceResults,
  TraceDetailDrawer,
  traceStatus,
  traceStatusClassName,
  traceStatusLabel,
} from "@/components/admin/TraceDetailDrawer";
import { Button } from "@/components/ui/button";
import { buildLoginPath } from "@/lib/auth-entry";
import { cn } from "@/lib/utils";
import { getAdminAuthToken, syncAdminAuthCookieFromStorage } from "@/services/admin";
import {
  getRecoEvaluationSummary,
  type RecoEvaluationSummary,
  type RecoMetricValue,
} from "@/services/reco";
import {
  getAdminTraceDetail,
  getTraceSuccessSummary,
  searchAdminTraces,
  type TraceDetail,
  type TraceKind,
  type TraceSearchItem,
  type TraceSuccessSummary,
} from "@/services/traces";

const RECO_METRICS: Array<Pick<RecoMetricValue, "key" | "label" | "category">> = [
  { key: "hit_rate", label: "命中率", category: "推荐效果" },
  { key: "precision", label: "准确率", category: "推荐效果" },
  { key: "ranking_quality", label: "排序质量", category: "推荐效果" },
  { key: "diversity", label: "多样性", category: "列表质量" },
  { key: "coverage", label: "覆盖率", category: "列表质量" },
  { key: "personalization", label: "个性化", category: "个性化" },
  { key: "ctr", label: "CTR", category: "用户行为" },
  { key: "cvr", label: "CVR", category: "用户行为" },
];

const formatPercent = (value?: number | null): string =>
  typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "--";

const formatCount = (value?: number): string =>
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Math.max(0, value ?? 0));

const clampMetric = (value?: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(1, value);
};

const prometheusMetricLabel = (metric?: string): string =>
  metric === "genrec_agent_requests_total" ? "Agent 请求" : "推荐请求";

const formatSummaryError = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  if (!rawMessage || rawMessage === "404 page not found" || rawMessage.includes("路由不存在")) {
    return "推荐指标采集接口暂不可用";
  }
  return rawMessage;
};

export default function AdminHomePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<AdminEnvironment>("prod");
  const [surface, setSurface] = useState<AdminSurfaceValue>("dashboard_recommend");
  const [windowValue, setWindowValue] = useState<AdminWindowValue>("1h");
  const [refreshTick, setRefreshTick] = useState(0);

  const [recoSummary, setRecoSummary] = useState<RecoEvaluationSummary | null>(null);
  const [traceSummary, setTraceSummary] = useState<TraceSuccessSummary | null>(null);
  const [traces, setTraces] = useState<TraceSearchItem[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [isRecoLoading, setIsRecoLoading] = useState(true);
  const [isTraceLoading, setIsTraceLoading] = useState(false);
  const [isTraceSummaryLoading, setIsTraceSummaryLoading] = useState(false);
  const [isTraceDetailLoading, setIsTraceDetailLoading] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [recoErrorMessage, setRecoErrorMessage] = useState<string | null>(null);
  const [traceErrorMessage, setTraceErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentToken = syncAdminAuthCookieFromStorage() ?? getAdminAuthToken();
    if (!currentToken) {
      router.replace(buildLoginPath({ role: "admin", next: "/admin" }));
      return;
    }
    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const loadRecoSummary = async () => {
      setIsRecoLoading(true);
      setRecoErrorMessage(null);
      try {
        const data = await getRecoEvaluationSummary({ surface, window: windowValue });
        if (!cancelled) {
          setRecoSummary(data);
        }
      } catch (error) {
        if (!cancelled) {
          setRecoSummary(null);
          setRecoErrorMessage(formatSummaryError(error));
        }
      } finally {
        if (!cancelled) {
          setIsRecoLoading(false);
        }
      }
    };

    void loadRecoSummary();
    return () => {
      cancelled = true;
    };
  }, [surface, windowValue, refreshTick]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const loadTraceOverview = async () => {
      setIsTraceLoading(true);
      setTraceErrorMessage(null);
      try {
        const kinds: TraceKind[] = ["failure", "timeout", "slow"];
        const responses = await Promise.all(
          kinds.map((kind) =>
            searchAdminTraces(token, {
              kind,
              limit: 12,
              window: windowValue,
            }),
          ),
        );
        if (!cancelled) {
          setTraces(
            mergeTraceResults(
              responses.flatMap((response) => response.traces),
              12,
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setTraces([]);
          setTraceErrorMessage(error instanceof Error ? error.message : "链路查询失败");
        }
      } finally {
        if (!cancelled) {
          setIsTraceLoading(false);
        }
      }
    };

    void loadTraceOverview();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, token, windowValue]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const loadTraceSummary = async () => {
      setIsTraceSummaryLoading(true);
      try {
        const response = await getTraceSuccessSummary(token, {
          limit: 100,
          window: windowValue,
        });
        if (!cancelled) {
          setTraceSummary(response.summary);
        }
      } catch (error) {
        if (!cancelled) {
          setTraceSummary(null);
          setTraceErrorMessage(error instanceof Error ? error.message : "观测汇总加载失败");
        }
      } finally {
        if (!cancelled) {
          setIsTraceSummaryLoading(false);
        }
      }
    };

    void loadTraceSummary();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, token, windowValue]);

  useEffect(() => {
    setIframeLoaded(false);
    const timer = window.setTimeout(() => setIframeLoaded(true), 5000);
    return () => window.clearTimeout(timer);
  }, [environment, surface, windowValue, refreshTick]);

  const selectedWindow =
    ADMIN_WINDOW_OPTIONS.find((item) => item.value === windowValue) ?? ADMIN_WINDOW_OPTIONS[0];

  const iframeSrc = `/api/admin/grafana/d/recommendation-evaluation/recommendation-evaluation?orgId=1&from=${encodeURIComponent(
    selectedWindow.grafanaFrom,
  )}&to=now&var-surface=${encodeURIComponent(surface)}&var-window=${encodeURIComponent(
    windowValue,
  )}&var-env=${encodeURIComponent(environment)}&theme=light&kiosk=1&refresh=${refreshTick}`;

  const metricRows = useMemo(
    () =>
      RECO_METRICS.map((metric) => {
        const current = recoSummary?.metric_values.find((item) => item.key === metric.key);
        return {
          ...metric,
          value: clampMetric(current?.value),
        };
      }),
    [recoSummary],
  );

  const anomalyItems = useMemo(() => {
    const items: Array<{ key: string; message: string; tone: "red" | "amber" }> = [];
    if (recoErrorMessage) {
      items.push({ key: "reco-error", message: recoErrorMessage, tone: "red" });
    }
    if (traceErrorMessage) {
      items.push({ key: "trace-error", message: traceErrorMessage, tone: "red" });
    }
    metricRows
      .filter((item) => {
        if (!recoSummary?.request_count) {
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
      .slice(0, 3)
      .forEach((item) => {
        items.push({
          key: item.key,
          message: `${item.label} 偏低，当前 ${formatPercent(item.value)}`,
          tone: "amber",
        });
      });
    return items;
  }, [metricRows, recoErrorMessage, recoSummary?.request_count, traceErrorMessage]);

  const openTrace = async (traceId: string) => {
    if (!token) {
      return;
    }
    setIsTraceDetailLoading(true);
    try {
      const response = await getAdminTraceDetail(token, traceId);
      setSelectedTrace(response.trace);
    } catch (error) {
      setTraceErrorMessage(error instanceof Error ? error.message : "链路详情加载失败");
    } finally {
      setIsTraceDetailLoading(false);
    }
  };

  const isRefreshing = isRecoLoading || isTraceLoading || isTraceSummaryLoading;

  return (
    <AdminShell
      title="监控总览"
      eyebrow="Admin Observability"
      description="推荐指标、请求成功率和未成功链路的统一入口"
      controls={{
        environment,
        isRefreshing,
        onEnvironmentChange: setEnvironment,
        onRefresh: () => setRefreshTick((value) => value + 1),
        onSurfaceChange: setSurface,
        onWindowChange: setWindowValue,
        surface,
        windowValue,
      }}
    >
      <AdminPageContainer>
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminKpiCard
            icon={PercentIcon}
            label="Prometheus 成功率"
            value={
              isTraceSummaryLoading ? "..." : formatPercent(traceSummary?.prometheus.success_rate)
            }
            meta={
              traceSummary
                ? `${prometheusMetricLabel(traceSummary.prometheus.metric)} ${formatCount(
                    traceSummary.prometheus.total_requests,
                  )} / 失败 ${formatCount(traceSummary.prometheus.failed_requests)}`
                : "等待指标"
            }
            tone="blue"
          />
          <AdminKpiCard
            icon={CheckCircle2Icon}
            label="Jaeger 样本成功率"
            value={
              isTraceSummaryLoading
                ? "..."
                : formatPercent(traceSummary?.jaeger.sample_success_rate)
            }
            meta={
              traceSummary
                ? `样本 ${formatCount(traceSummary.jaeger.sample_total)} 条`
                : "等待 trace"
            }
            tone="green"
          />
          <AdminKpiCard
            icon={AlertTriangleIcon}
            label="失败链路"
            value={traceSummary ? formatCount(traceSummary.jaeger.failure_count) : "--"}
            meta="error span 命中的 trace"
            tone="red"
          />
          <AdminKpiCard
            icon={Clock3Icon}
            label="慢/超时链路"
            value={traceSummary ? formatCount(traceSummary.jaeger.latency_count) : "--"}
            meta="timeout 与 slow 去重"
            tone="amber"
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <AdminPanel
            title={
              <span className="flex items-center gap-2">
                <LineChartIcon className="size-4 text-sky-600" />
                Grafana 推荐指标看板
              </span>
            }
            actions={
              <span
                className={cn(
                  "rounded border px-2 py-1 text-xs font-medium",
                  iframeLoaded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500",
                )}
              >
                {iframeLoaded ? "已加载" : "加载中"}
              </span>
            }
            className="min-h-[34rem]"
          >
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              title="推荐指标 Grafana 看板"
              className="h-[34rem] w-full border-0 bg-white md:h-[40rem]"
              onLoad={() => setIframeLoaded(true)}
            />
          </AdminPanel>

          <AdminPanel
            title={
              <span className="flex items-center gap-2">
                <GitBranchIcon className="size-4 text-slate-700" />
                未成功链路
              </span>
            }
            actions={
              <Button asChild variant="outline" size="sm" className="h-8 rounded-md">
                <Link href="/admin/traces">查看全部</Link>
              </Button>
            }
            className="min-h-[34rem]"
          >
            <div className="divide-y divide-slate-100">
              {traces.map((trace) => {
                const status = traceStatus(trace);
                return (
                  <button
                    key={trace.trace_id}
                    type="button"
                    onClick={() => void openTrace(trace.trace_id)}
                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-sky-50/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={traceStatusClassName(status)}>
                        {traceStatusLabel(status)}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {formatTraceDuration(trace.duration_ms)}
                      </span>
                    </div>
                    <div className="mt-2 min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {trace.root_service_name || "--"}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-slate-500">
                        {trace.root_operation_name || "--"}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-mono">{compactTraceId(trace.trace_id)}</span>
                      <span>{formatTraceStartTime(trace.start_time_unix_nano)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {!isTraceLoading && traces.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center px-4 text-center text-sm text-slate-500">
                当前窗口暂无失败或慢链路
              </div>
            ) : null}
            {isTraceLoading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
                链路加载中...
              </div>
            ) : null}
          </AdminPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <AdminPanel
            title={
              <span className="flex items-center gap-2">
                <TablePropertiesIcon className="size-4 text-sky-600" />
                推荐指标快照
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {metricRows.map((item) => (
                <div key={item.key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.category}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-900">
                      {formatPercent(item.value)}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded bg-slate-200">
                    <div
                      className="h-full rounded bg-sky-500"
                      style={{ width: `${Math.round(item.value * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel
            title={
              <span className="flex items-center gap-2">
                <ActivityIcon className="size-4 text-slate-700" />
                异常与告警
              </span>
            }
          >
            <div className="space-y-2 p-4">
              {anomalyItems.length ? (
                anomalyItems.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium",
                      item.tone === "red"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-800",
                    )}
                  >
                    {item.message}
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  当前窗口暂无异常
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">推荐请求</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatCount(recoSummary?.request_count)}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">曝光</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatCount(recoSummary?.impression_count)}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">点击</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatCount(recoSummary?.click_count)}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">转化</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {formatCount(recoSummary?.conversion_count)}
                  </p>
                </div>
              </div>
            </div>
          </AdminPanel>
        </section>
      </AdminPageContainer>

      <TraceDetailDrawer
        isLoading={isTraceDetailLoading}
        onClose={() => setSelectedTrace(null)}
        trace={selectedTrace}
      />
    </AdminShell>
  );
}
