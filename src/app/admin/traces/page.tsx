"use client";

import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  ExternalLinkIcon,
  GitBranchIcon,
  PercentIcon,
  RefreshCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminPageContainer } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildLoginPath } from "@/lib/auth-entry";
import { cn } from "@/lib/utils";
import { getAdminAuthToken, syncAdminAuthCookieFromStorage } from "@/services/admin";
import {
  getAdminTraceDetail,
  getTraceOperations,
  getTraceServices,
  getTraceSuccessSummary,
  searchAdminTraces,
  type TraceDetail,
  type TraceKind,
  type TraceSearchItem,
  type TraceSpanItem,
  type TraceSuccessSummary,
  type TraceWindow,
} from "@/services/traces";

type TraceView = "failure" | "latency" | "all";

const ALL_VALUE = "__all__";

const VIEW_OPTIONS: Array<{
  value: TraceView;
  label: string;
  icon: typeof AlertTriangleIcon;
}> = [
  { value: "failure", label: "失败", icon: AlertTriangleIcon },
  { value: "latency", label: "超时与慢请求", icon: Clock3Icon },
  { value: "all", label: "全部", icon: ActivityIcon },
];

const WINDOW_OPTIONS: Array<{ value: TraceWindow; label: string }> = [
  { value: "1h", label: "近 1 小时" },
  { value: "24h", label: "近 24 小时" },
  { value: "7d", label: "近 7 天" },
];

const KEY_ATTRIBUTE_ORDER = [
  "sea.error.kind",
  "sea.biz_code",
  "sea.biz_msg",
  "sea.timeout",
  "sea.slow",
  "sea.duration_ms",
  "http.route",
  "rpc.method",
  "messaging.destination",
];

const formatDuration = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0ms";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}ms`;
};

const formatNanoTime = (value: string): string => {
  try {
    const millis = Number(BigInt(value || "0") / BigInt(1000000));
    if (!millis) {
      return "--";
    }
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(millis));
  } catch {
    return "--";
  }
};

const compactTraceId = (traceId: string): string =>
  traceId.length > 18 ? `${traceId.slice(0, 12)}...${traceId.slice(-6)}` : traceId;

const formatPercent = (value?: number | null): string =>
  typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "--";

const formatCount = (value?: number): string =>
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Math.max(0, value ?? 0));

const prometheusMetricLabel = (metric?: string): string =>
  metric === "genrec_agent_requests_total" ? "Agent 请求" : "推荐请求";

const traceStatus = (trace: TraceSearchItem): "timeout" | "slow" | "failure" | "ok" => {
  if (trace.matched_kind === "timeout") {
    return "timeout";
  }
  if (trace.matched_kind === "slow") {
    return "slow";
  }
  if (trace.error_span_count > 0 || trace.matched_kind === "failure") {
    return "failure";
  }
  return "ok";
};

const statusLabel = (status: ReturnType<typeof traceStatus>): string => {
  switch (status) {
    case "timeout":
      return "timeout";
    case "slow":
      return "slow";
    case "failure":
      return "error";
    default:
      return "ok";
  }
};

const statusClassName = (status: ReturnType<typeof traceStatus>): string =>
  cn(
    "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
    status === "timeout" && "border-rose-200 bg-rose-50 text-rose-700",
    status === "slow" && "border-amber-200 bg-amber-50 text-amber-700",
    status === "failure" && "border-red-200 bg-red-50 text-red-700",
    status === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
  );

const mergeTraces = (items: TraceSearchItem[], limit: number): TraceSearchItem[] => {
  const merged = new Map<string, TraceSearchItem>();
  for (const item of items) {
    const existing = merged.get(item.trace_id);
    if (!existing || item.matched_kind === "timeout") {
      merged.set(item.trace_id, item);
    }
  }
  return Array.from(merged.values())
    .sort((left, right) => {
      try {
        return Number(BigInt(right.start_time_unix_nano) - BigInt(left.start_time_unix_nano));
      } catch {
        return 0;
      }
    })
    .slice(0, limit);
};

const buildSpanRows = (spans: TraceSpanItem[]): Array<TraceSpanItem & { depth: number }> => {
  const byParent = new Map<string, TraceSpanItem[]>();
  const byId = new Map(spans.map((span) => [span.span_id, span]));

  spans.forEach((span) => {
    const parentId =
      span.parent_span_id && byId.has(span.parent_span_id) ? span.parent_span_id : "";
    const siblings = byParent.get(parentId) ?? [];
    siblings.push(span);
    byParent.set(parentId, siblings);
  });

  const rows: Array<TraceSpanItem & { depth: number }> = [];
  const visit = (span: TraceSpanItem, depth: number, seen: Set<string>) => {
    if (seen.has(span.span_id)) {
      return;
    }
    seen.add(span.span_id);
    rows.push({ ...span, depth });
    const children = byParent.get(span.span_id) ?? [];
    children
      .sort((left, right) => {
        try {
          return Number(BigInt(left.start_time_unix_nano) - BigInt(right.start_time_unix_nano));
        } catch {
          return 0;
        }
      })
      .forEach((child) => visit(child, depth + 1, seen));
  };

  (byParent.get("") ?? []).forEach((root) => visit(root, 0, new Set<string>()));
  return rows.length === spans.length ? rows : spans.map((span) => ({ ...span, depth: 0 }));
};

export default function AdminTracesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<TraceView>("failure");
  const [windowValue, setWindowValue] = useState<TraceWindow>("1h");
  const [service, setService] = useState("");
  const [operation, setOperation] = useState("");
  const [limit, setLimit] = useState(50);
  const [services, setServices] = useState<string[]>([]);
  const [operations, setOperations] = useState<string[]>([]);
  const [traces, setTraces] = useState<TraceSearchItem[]>([]);
  const [summary, setSummary] = useState<TraceSuccessSummary | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryErrorMessage, setSummaryErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const currentToken = syncAdminAuthCookieFromStorage() ?? getAdminAuthToken();
    if (!currentToken) {
      router.replace(buildLoginPath({ role: "admin", next: "/admin/traces" }));
      return;
    }
    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const loadServices = async () => {
      try {
        const response = await getTraceServices(token);
        if (!cancelled) {
          setServices(response.services);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "服务列表加载失败");
          setServices([]);
        }
      }
    };

    void loadServices();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !service) {
      setOperations([]);
      setOperation("");
      return;
    }

    let cancelled = false;
    const loadOperations = async () => {
      try {
        const response = await getTraceOperations(token, service);
        if (!cancelled) {
          setOperations(response.operations);
        }
      } catch {
        if (!cancelled) {
          setOperations([]);
        }
      }
    };

    void loadOperations();
    return () => {
      cancelled = true;
    };
  }, [operation, service, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const loadTraces = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const kinds: TraceKind[] =
          view === "latency" ? ["timeout", "slow"] : [view === "all" ? "all" : "failure"];
        const responses = await Promise.all(
          kinds.map((kind) =>
            searchAdminTraces(token, {
              kind,
              service: service || undefined,
              operation: operation || undefined,
              window: windowValue,
              limit,
            }),
          ),
        );
        if (!cancelled) {
          setTraces(
            mergeTraces(
              responses.flatMap((response) => response.traces),
              limit,
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "链路查询失败");
          setTraces([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTraces();
    return () => {
      cancelled = true;
    };
  }, [limit, operation, refreshTick, service, token, view, windowValue]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const loadSummary = async () => {
      setIsLoadingSummary(true);
      setSummaryErrorMessage(null);
      try {
        const response = await getTraceSuccessSummary(token, {
          service: service || undefined,
          operation: operation || undefined,
          window: windowValue,
          limit: Math.max(limit, 100),
        });
        if (!cancelled) {
          setSummary(response.summary);
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null);
          setSummaryErrorMessage(error instanceof Error ? error.message : "观测汇总加载失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSummary(false);
        }
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [limit, operation, refreshTick, service, token, windowValue]);

  const openTrace = async (traceId: string) => {
    if (!token) {
      return;
    }
    setIsLoadingDetail(true);
    try {
      const response = await getAdminTraceDetail(token, traceId);
      setSelectedTrace(response.trace);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "链路详情加载失败");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const spanRows = useMemo(
    () => (selectedTrace ? buildSpanRows(selectedTrace.spans) : []),
    [selectedTrace],
  );

  const selectedTraceSummary = useMemo(() => {
    if (!selectedTrace) {
      return null;
    }
    const errorCount = selectedTrace.spans.filter((span) => span.error).length;
    const timeoutCount = selectedTrace.spans.filter((span) => span.timeout).length;
    const slowCount = selectedTrace.spans.filter((span) => span.slow).length;
    return { errorCount, timeoutCount, slowCount };
  }, [selectedTrace]);

  const summaryCards = useMemo(
    () => [
      {
        key: "prometheus",
        label: "Prometheus 成功率",
        value: formatPercent(summary?.prometheus.success_rate),
        meta: summary
          ? `${prometheusMetricLabel(summary.prometheus.metric)} ${formatCount(
              summary.prometheus.total_requests,
            )} 次 / 失败 ${formatCount(summary.prometheus.failed_requests)}`
          : summaryErrorMessage || "等待指标",
        icon: PercentIcon,
        tone: "text-sky-600",
      },
      {
        key: "jaeger",
        label: "Jaeger 样本成功率",
        value: formatPercent(summary?.jaeger.sample_success_rate),
        meta: summary ? `样本 ${formatCount(summary.jaeger.sample_total)} 条` : "等待 trace",
        icon: CheckCircle2Icon,
        tone: "text-emerald-600",
      },
      {
        key: "failure",
        label: "未成功链路",
        value: summary ? formatCount(summary.jaeger.failure_count) : "--",
        meta: "error span 命中的 trace",
        icon: AlertTriangleIcon,
        tone: "text-red-600",
      },
      {
        key: "latency",
        label: "慢/超时链路",
        value: summary ? formatCount(summary.jaeger.latency_count) : "--",
        meta: "timeout 与 slow 去重",
        icon: Clock3Icon,
        tone: "text-amber-600",
      },
    ],
    [summary, summaryErrorMessage],
  );

  return (
    <AdminShell title="链路追踪" eyebrow="Jaeger Traces" description="失败、慢请求与 span 明细">
      <AdminPageContainer className="space-y-5 py-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
              <GitBranchIcon className="size-4" />
              Jaeger Traces
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">链路追踪</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin">返回管理中心</Link>
            </Button>
            <Button onClick={() => setRefreshTick((value) => value + 1)} disabled={isLoading}>
              <RefreshCcwIcon className={cn("size-4", isLoading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{card.label}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                      {isLoadingSummary ? "..." : card.value}
                    </p>
                  </div>
                  <Icon className={cn("size-5 shrink-0", card.tone)} />
                </div>
                <p className="mt-3 truncate text-xs text-slate-500">{card.meta}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_0.7fr] xl:grid-cols-[1.2fr_1fr_1fr_0.7fr_0.5fr]">
            <div className="space-y-2">
              <Label>类型</Label>
              <div className="grid grid-cols-3 gap-2">
                {VIEW_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setView(option.value)}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition",
                        view === option.value
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>时间窗口</Label>
              <Select
                value={windowValue}
                onValueChange={(value) => setWindowValue(value as TraceWindow)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDOW_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>服务</Label>
              <Select
                value={service || ALL_VALUE}
                onValueChange={(value) => {
                  setService(value === ALL_VALUE ? "" : value);
                  setOperation("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>全部服务</SelectItem>
                  {services.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>操作</Label>
              <Select
                value={operation || ALL_VALUE}
                onValueChange={(value) => setOperation(value === ALL_VALUE ? "" : value)}
                disabled={!service}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>全部操作</SelectItem>
                  {operations.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Limit</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(event) => setLimit(Math.max(1, Number(event.target.value) || 1))}
                className="h-10 rounded-full"
              />
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <SearchIcon className="size-4" />
              {isLoading ? "查询中..." : `${traces.length} 条链路`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
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
                        <span className={statusClassName(status)}>{statusLabel(status)}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {trace.root_service_name || "--"}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <span className="block truncate font-mono text-xs text-slate-700">
                          {trace.root_operation_name || "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-900">
                        {formatDuration(trace.duration_ms)}
                      </td>
                      <td className="px-4 py-3">{trace.span_count}</td>
                      <td className="px-4 py-3">{trace.error_span_count}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {compactTraceId(trace.trace_id)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatNanoTime(trace.start_time_unix_nano)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isLoading && traces.length === 0 && (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              暂无链路
            </div>
          )}
        </section>

        {(selectedTrace || isLoadingDetail) && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/35"
            onClick={() => setSelectedTrace(null)}
          >
            <aside
              className="absolute top-0 right-0 flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                    Trace Detail
                  </p>
                  <h2 className="truncate font-mono text-sm font-semibold text-slate-950">
                    {selectedTrace?.trace_id ?? "loading"}
                  </h2>
                </div>
                <div className="flex shrink-0 gap-2">
                  {selectedTrace && (
                    <Button asChild variant="outline" size="sm">
                      <a href={selectedTrace.jaeger_url} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon className="size-4" />
                        Open in Jaeger
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTrace(null)}>
                    <XIcon className="size-5" />
                  </Button>
                </div>
              </div>

              {selectedTrace && selectedTraceSummary && (
                <div className="grid grid-cols-3 gap-3 border-b border-slate-200 p-4 text-sm">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-slate-500">错误 Span</p>
                    <p className="text-xl font-bold text-red-600">
                      {selectedTraceSummary.errorCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-slate-500">超时 Span</p>
                    <p className="text-xl font-bold text-rose-600">
                      {selectedTraceSummary.timeoutCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-slate-500">慢调用 Span</p>
                    <p className="text-xl font-bold text-amber-600">
                      {selectedTraceSummary.slowCount}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingDetail && !selectedTrace ? (
                  <p className="text-sm text-slate-500">详情加载中...</p>
                ) : (
                  <div className="space-y-2">
                    {spanRows.map((span) => {
                      const attrs = KEY_ATTRIBUTE_ORDER.filter((key) => span.attributes[key]).map(
                        (key) => [key, span.attributes[key]] as const,
                      );
                      return (
                        <div
                          key={span.span_id}
                          className={cn(
                            "rounded-xl border bg-white p-3",
                            span.error ? "border-red-200" : "border-slate-200",
                          )}
                        >
                          <div
                            className="flex flex-wrap items-center gap-2"
                            style={{ paddingLeft: `${span.depth * 18}px` }}
                          >
                            <GitBranchIcon className="size-4 text-slate-400" />
                            <span className="font-mono text-xs font-semibold text-slate-900">
                              {span.operation_name || "--"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {span.service_name}
                            </span>
                            {span.error && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                error
                              </span>
                            )}
                            {span.timeout && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                timeout
                              </span>
                            )}
                            {span.slow && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                slow
                              </span>
                            )}
                            <span className="ml-auto font-mono text-xs text-slate-600">
                              {formatDuration(span.duration_ms)}
                            </span>
                          </div>
                          {attrs.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2 pl-6 text-xs">
                              {attrs.map(([key, value]) => (
                                <span
                                  key={`${span.span_id}-${key}`}
                                  className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 font-mono text-slate-600"
                                >
                                  {key}={value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </AdminPageContainer>
    </AdminShell>
  );
}
