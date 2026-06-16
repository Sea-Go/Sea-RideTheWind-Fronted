"use client";

import { ExternalLinkIcon, GitBranchIcon, XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TraceDetail, TraceKind, TraceSearchItem, TraceSpanItem } from "@/services/traces";

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

export const formatTraceDuration = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0ms";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}ms`;
};

export const formatTraceStartTime = (value: string): string => {
  try {
    const millis = Number(BigInt(value || "0") / BigInt(1000000));
    if (!millis) {
      return "--";
    }
    return new Intl.DateTimeFormat("zh-CN", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
    }).format(new Date(millis));
  } catch {
    return "--";
  }
};

export const compactTraceId = (traceId: string): string =>
  traceId.length > 18 ? `${traceId.slice(0, 12)}...${traceId.slice(-6)}` : traceId;

export const traceStatus = (trace: TraceSearchItem): "timeout" | "slow" | "failure" | "ok" => {
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

export const traceStatusLabel = (status: ReturnType<typeof traceStatus>): string => {
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

export const traceStatusClassName = (
  status: ReturnType<typeof traceStatus>,
  className?: string,
): string =>
  cn(
    "inline-flex h-6 items-center rounded border px-2 text-xs font-semibold",
    status === "timeout" && "border-rose-200 bg-rose-50 text-rose-700",
    status === "slow" && "border-amber-200 bg-amber-50 text-amber-700",
    status === "failure" && "border-red-200 bg-red-50 text-red-700",
    status === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
    className,
  );

export const mergeTraceResults = (items: TraceSearchItem[], limit: number): TraceSearchItem[] => {
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

export const traceKindLabel = (kind: TraceKind): string => {
  switch (kind) {
    case "failure":
      return "失败";
    case "timeout":
      return "超时";
    case "slow":
      return "慢请求";
    default:
      return "全部";
  }
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

export function TraceDetailDrawer({
  isLoading,
  onClose,
  trace,
}: {
  isLoading?: boolean;
  onClose: () => void;
  trace: TraceDetail | null;
}) {
  if (!trace && !isLoading) {
    return null;
  }

  const spanRows = trace ? buildSpanRows(trace.spans) : [];
  const errorCount = spanRows.filter((span) => span.error).length;
  const timeoutCount = spanRows.filter((span) => span.timeout).length;
  const slowCount = spanRows.filter((span) => span.slow).length;

  const drawerButtonProps: ComponentProps<typeof Button> = {
    className: "rounded-md",
    size: "sm",
    variant: "outline",
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35" onClick={onClose}>
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
              {trace?.trace_id ?? "loading"}
            </h2>
          </div>
          <div className="flex shrink-0 gap-2">
            {trace ? (
              <Button asChild {...drawerButtonProps}>
                <a href={trace.jaeger_url} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="size-4" />
                  Open in Jaeger
                </a>
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" className="rounded-md" onClick={onClose}>
              <XIcon className="size-5" />
            </Button>
          </div>
        </div>

        {trace ? (
          <div className="grid grid-cols-3 gap-3 border-b border-slate-200 p-4 text-sm">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-slate-500">错误 Span</p>
              <p className="text-xl font-semibold text-red-600">{errorCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-slate-500">超时 Span</p>
              <p className="text-xl font-semibold text-rose-600">{timeoutCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-slate-500">慢调用 Span</p>
              <p className="text-xl font-semibold text-amber-600">{slowCount}</p>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && !trace ? (
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
                      "rounded-md border bg-white p-3",
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
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {span.service_name}
                      </span>
                      {span.error ? (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          error
                        </span>
                      ) : null}
                      {span.timeout ? (
                        <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          timeout
                        </span>
                      ) : null}
                      {span.slow ? (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          slow
                        </span>
                      ) : null}
                      <span className="ml-auto font-mono text-xs text-slate-600">
                        {formatTraceDuration(span.duration_ms)}
                      </span>
                    </div>
                    {attrs.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2 pl-6 text-xs">
                        {attrs.map(([key, value]) => (
                          <span
                            key={`${span.span_id}-${key}`}
                            className="max-w-full truncate rounded bg-slate-100 px-2 py-1 font-mono text-slate-600"
                          >
                            {key}={value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
