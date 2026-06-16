import { request, withBearerAuthorization } from "@/services/request";

export type TraceKind = "failure" | "timeout" | "slow" | "all";
export type TraceWindow = "1h" | "24h" | "7d";

export interface TraceServiceSummary {
  name: string;
  span_count: number;
  error_span_count: number;
}

export interface TraceSearchItem {
  trace_id: string;
  root_service_name: string;
  root_operation_name: string;
  start_time_unix_nano: string;
  duration_ms: number;
  span_count: number;
  error_span_count: number;
  services: TraceServiceSummary[];
  matched_kind: TraceKind;
  jaeger_url: string;
}

export interface TraceSpanItem {
  span_id: string;
  parent_span_id: string;
  service_name: string;
  operation_name: string;
  start_time_unix_nano: string;
  duration_ms: number;
  status_code: string;
  error: boolean;
  timeout: boolean;
  slow: boolean;
  attributes: Record<string, string>;
}

export interface TraceDetail {
  trace_id: string;
  jaeger_url: string;
  spans: TraceSpanItem[];
  raw: unknown;
}

export interface TraceSuccessSummary {
  prometheus: {
    success_rate: number | null;
    total_requests: number;
    failed_requests: number;
    metric: string;
  };
  jaeger: {
    sample_success_rate: number | null;
    sample_total: number;
    failure_count: number;
    latency_count: number;
  };
}

export interface TraceSearchParams {
  kind: TraceKind;
  service?: string;
  operation?: string;
  window: TraceWindow;
  limit: number;
}

const buildQueryString = (params: object): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) {
      search.set(key, String(value));
    }
  });
  return search.toString();
};

export const getTraceServices = (token: string): Promise<{ services: string[] }> =>
  request<{ services: string[] }>("/api/admin/traces/services", {
    headers: withBearerAuthorization(token),
  });

export const getTraceOperations = (
  token: string,
  service: string,
): Promise<{ operations: string[] }> =>
  request<{ operations: string[] }>(
    `/api/admin/traces/operations?${buildQueryString({ service })}`,
    {
      headers: withBearerAuthorization(token),
    },
  );

export const searchAdminTraces = (
  token: string,
  params: TraceSearchParams,
): Promise<{ traces: TraceSearchItem[] }> =>
  request<{ traces: TraceSearchItem[] }>(`/api/admin/traces/search?${buildQueryString(params)}`, {
    headers: withBearerAuthorization(token),
  });

export const getTraceSuccessSummary = (
  token: string,
  params: Omit<TraceSearchParams, "kind">,
): Promise<{ summary: TraceSuccessSummary }> =>
  request<{ summary: TraceSuccessSummary }>(
    `/api/admin/traces/summary?${buildQueryString(params)}`,
    {
      headers: withBearerAuthorization(token),
    },
  );

export const getAdminTraceDetail = (
  token: string,
  traceId: string,
): Promise<{ trace: TraceDetail }> =>
  request<{ trace: TraceDetail }>(`/api/admin/traces/${encodeURIComponent(traceId)}`, {
    headers: withBearerAuthorization(token),
  });
