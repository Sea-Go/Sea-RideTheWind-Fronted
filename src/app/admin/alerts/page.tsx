"use client";

import {
  ActivityIcon,
  AlertTriangleIcon,
  BellIcon,
  CheckCircle2Icon,
  Clock3Icon,
  GitBranchIcon,
  PercentIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminKpiCard, AdminPageContainer, AdminPanel } from "@/components/admin/AdminPanel";
import {
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

const RECO_ALERT_METRICS: Array<{
  key: string;
  label: string;
  threshold: number;
}> = [
  { key: "hit_rate", label: "命中率", threshold: 0.2 },
  { key: "precision", label: "准确率", threshold: 0.2 },
  { key: "ranking_quality", label: "排序质量", threshold: 0.2 },
  { key: "ctr", label: "CTR", threshold: 0.03 },
  { key: "cvr", label: "CVR", threshold: 0.08 },
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

const findMetric = (
  summary: RecoEvaluationSummary | null,
  key: string,
): RecoMetricValue | undefined => summary?.metric_values.find((item) => item.key === key);

type AlertTone = "red" | "amber" | "blue" | "green";

interface AlertRow {
  key: string;
  title: string;
  detail: string;
  tone: AlertTone;
}

const alertToneClassName: Record<AlertTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function AdminAlertsPage() {
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
  const [recoErrorMessage, setRecoErrorMessage] = useState<string | null>(null);
  const [traceErrorMessage, setTraceErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentToken = syncAdminAuthCookieFromStorage() ?? getAdminAuthToken();
    if (!currentToken) {
      router.replace(buildLoginPath({ role: "admin", next: "/admin/alerts" }));
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
        const response = await getRecoEvaluationSummary({ surface, window: windowValue });
        if (!cancelled) {
          setRecoSummary(response);
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
  }, [refreshTick, surface, windowValue]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const loadTraceSummary = async () => {
      setIsTraceSummaryLoading(true);
      setTraceErrorMessage(null);
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
    if (!token) {
      return;
    }

    let cancelled = false;
    const loadTraces = async () => {
      setIsTraceLoading(true);
      setTraceErrorMessage(null);
      try {
        const kinds: TraceKind[] = ["failure", "timeout", "slow"];
        const responses = await Promise.all(
          kinds.map((kind) =>
            searchAdminTraces(token, {
              kind,
              limit: 30,
              window: windowValue,
            }),
          ),
        );
        if (!cancelled) {
          setTraces(
            mergeTraceResults(
              responses.flatMap((response) => response.traces),
              30,
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

    void loadTraces();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, token, windowValue]);

  const alertRows = useMemo<AlertRow[]>(() => {
    const rows: AlertRow[] = [];

    if (recoErrorMessage) {
      rows.push({
        detail: recoErrorMessage,
        key: "reco-error",
        title: "推荐指标接口异常",
        tone: "red",
      });
    }
    if (traceErrorMessage) {
      rows.push({
        detail: traceErrorMessage,
        key: "trace-error",
        title: "链路观测接口异常",
        tone: "red",
      });
    }

    if (recoSummary && !recoSummary.request_count) {
      rows.push({
        detail:
          "当前筛选窗口没有推荐请求，请等待真实用户行为进入，或在验收环境通过用户区推荐链路回放访问。",
        key: "reco-empty",
        title: "推荐指标暂无流量",
        tone: "blue",
      });
    }

    if (recoSummary?.request_count) {
      RECO_ALERT_METRICS.forEach((metric) => {
        const current = clampMetric(findMetric(recoSummary, metric.key)?.value);
        if (current < metric.threshold) {
          rows.push({
            detail: `当前 ${formatPercent(current)}，阈值 ${formatPercent(metric.threshold)}`,
            key: `reco-${metric.key}`,
            title: `${metric.label} 低于阈值`,
            tone: "amber",
          });
        }
      });
    }

    if (
      typeof traceSummary?.prometheus.success_rate === "number" &&
      traceSummary.prometheus.success_rate < 0.98
    ) {
      rows.push({
        detail: `${prometheusMetricLabel(traceSummary.prometheus.metric)} ${formatCount(
          traceSummary.prometheus.total_requests,
        )} 次 / 失败 ${formatCount(traceSummary.prometheus.failed_requests)} 次`,
        key: "prometheus-success",
        title: "Prometheus 成功率偏低",
        tone: "red",
      });
    }

    if (
      typeof traceSummary?.jaeger.sample_success_rate === "number" &&
      traceSummary.jaeger.sample_success_rate < 0.95
    ) {
      rows.push({
        detail: `样本 ${formatCount(traceSummary.jaeger.sample_total)} 条，成功率 ${formatPercent(
          traceSummary.jaeger.sample_success_rate,
        )}`,
        key: "jaeger-success",
        title: "Jaeger 样本成功率偏低",
        tone: "red",
      });
    }

    if (traceSummary?.jaeger.failure_count) {
      rows.push({
        detail: `${formatCount(traceSummary.jaeger.failure_count)} 条 trace 命中 error span`,
        key: "failure-traces",
        title: "存在失败链路",
        tone: "red",
      });
    }

    if (traceSummary?.jaeger.latency_count) {
      rows.push({
        detail: `${formatCount(traceSummary.jaeger.latency_count)} 条 trace 命中 timeout 或 slow`,
        key: "latency-traces",
        title: "存在慢/超时链路",
        tone: "amber",
      });
    }

    if (!rows.length && !isRecoLoading && !isTraceLoading && !isTraceSummaryLoading) {
      rows.push({
        detail: "推荐指标和链路追踪在当前窗口内未触发告警。",
        key: "healthy",
        title: "当前窗口暂无告警",
        tone: "green",
      });
    }

    return rows;
  }, [
    isRecoLoading,
    isTraceLoading,
    isTraceSummaryLoading,
    recoErrorMessage,
    recoSummary,
    traceErrorMessage,
    traceSummary,
  ]);

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
      title="告警"
      eyebrow="Admin Alerts"
      description="推荐指标异常、成功率异常与未成功链路"
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

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <AdminPanel
            title={
              <span className="flex items-center gap-2">
                <BellIcon className="size-4 text-amber-600" />
                告警聚合
              </span>
            }
          >
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {alertRows.map((item) => (
                <div
                  key={item.key}
                  className={cn("rounded-md border px-3 py-3", alertToneClassName[item.tone])}
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 opacity-90">{item.detail}</p>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel
            title={
              <span className="flex items-center gap-2">
                <ActivityIcon className="size-4 text-sky-600" />
                推荐指标快照
              </span>
            }
          >
            <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">推荐请求</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {formatCount(recoSummary?.request_count)}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">曝光</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {formatCount(recoSummary?.impression_count)}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">点击</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {formatCount(recoSummary?.click_count)}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">转化</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {formatCount(recoSummary?.conversion_count)}
                </dd>
              </div>
            </dl>
          </AdminPanel>
        </section>

        <AdminPanel
          title={
            <span className="flex items-center gap-2">
              <GitBranchIcon className="size-4 text-slate-700" />
              失败与慢链路
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">根服务</th>
                  <th className="px-4 py-3">根操作</th>
                  <th className="px-4 py-3">耗时</th>
                  <th className="px-4 py-3">Span</th>
                  <th className="px-4 py-3">错误</th>
                  <th className="px-4 py-3">Trace ID</th>
                  <th className="px-4 py-3">开始时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {traces.map((trace) => {
                  const status = traceStatus(trace);
                  return (
                    <tr
                      key={trace.trace_id}
                      className="cursor-pointer hover:bg-sky-50/60"
                      onClick={() => void openTrace(trace.trace_id)}
                    >
                      <td className="px-4 py-3">
                        <span className={traceStatusClassName(status)}>
                          {traceStatusLabel(status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {trace.root_service_name || "--"}
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <span className="block truncate font-mono text-xs text-slate-700">
                          {trace.root_operation_name || "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-900">
                        {formatTraceDuration(trace.duration_ms)}
                      </td>
                      <td className="px-4 py-3">{trace.span_count}</td>
                      <td className="px-4 py-3">{trace.error_span_count}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {compactTraceId(trace.trace_id)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTraceStartTime(trace.start_time_unix_nano)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isTraceLoading && traces.length === 0 ? (
            <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">
              当前窗口暂无失败或慢链路
            </div>
          ) : null}
          {isTraceLoading ? (
            <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">
              链路加载中...
            </div>
          ) : null}
        </AdminPanel>
      </AdminPageContainer>

      <TraceDetailDrawer
        isLoading={isTraceDetailLoading}
        onClose={() => setSelectedTrace(null)}
        trace={selectedTrace}
      />
    </AdminShell>
  );
}
