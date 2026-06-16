import { trimServerUrl } from "@/app/api/admin/_shared/auth";

export type TraceKind = "failure" | "timeout" | "slow" | "all";
export type TraceWindow = "1h" | "24h" | "7d";

export interface TraceSearchParams {
  kind: TraceKind;
  service?: string;
  operation?: string;
  window: TraceWindow;
  limit: number;
}

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

const WINDOW_TO_MS: Record<TraceWindow, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const MAX_SERVICE_FANOUT = 32;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    const candidate = asString(value).trim();
    if (candidate) {
      return candidate;
    }
  }
  return "";
};

const boolish = (value: unknown): boolean =>
  value === true || value === "true" || value === "1" || value === 1;

const numberToNanoString = (value: unknown, multiplier: bigint): string => {
  if (typeof value === "string" && value.trim()) {
    const parsed = BigInt(Math.trunc(Number(value)));
    return (parsed * multiplier).toString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return (BigInt(Math.trunc(value)) * multiplier).toString();
  }
  return "0";
};

const nanoDurationMs = (startNano: string, endNano: string): number => {
  try {
    const durationNano = BigInt(endNano || "0") - BigInt(startNano || "0");
    if (durationNano <= BigInt(0)) {
      return 0;
    }
    return Number(durationNano / BigInt(1000000));
  } catch {
    return 0;
  }
};

const getSlowThresholdMs = (): number => {
  const raw =
    process.env.SEA_OBSERVABILITY_SLOW_THRESHOLD_MS ?? process.env.SEA_OBSERVABILITY_SLOW_THRESHOLD;
  if (!raw) {
    return 500;
  }

  if (/^\d+$/.test(raw.trim())) {
    return Math.max(1, Number(raw));
  }
  if (raw.endsWith("ms")) {
    return Math.max(1, Number(raw.slice(0, -2)));
  }
  if (raw.endsWith("s")) {
    return Math.max(1, Number(raw.slice(0, -1)) * 1000);
  }
  return 500;
};

const getJaegerUrl = (): string =>
  trimServerUrl(
    process.env.JAEGER_QUERY_INTERNAL_URL ??
      process.env.JAEGER_QUERY_SERVER_URL ??
      process.env.JAEGER_INTERNAL_URL ??
      process.env.JAEGER_SERVER_URL ??
      "http://localhost:16686",
  );

const getJaegerPublicUrl = (): string =>
  trimServerUrl(
    process.env.JAEGER_PUBLIC_URL ??
      process.env.JAEGER_QUERY_PUBLIC_URL ??
      process.env.JAEGER_SERVER_URL ??
      "http://localhost:16686",
  );

const getPrometheusUrl = (): string =>
  trimServerUrl(
    process.env.PROMETHEUS_INTERNAL_URL ??
      process.env.PROMETHEUS_SERVER_URL ??
      "http://localhost:39090",
  );

const buildJaegerTraceUrl = (traceId: string): string => `${getJaegerPublicUrl()}/trace/${traceId}`;

const fetchJaeger = async (path: string, init?: RequestInit): Promise<unknown> => {
  const baseUrl = getJaegerUrl();
  if (!baseUrl) {
    throw new Error("Jaeger 服务地址未配置");
  }

  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    const payload = parseJsonStream(text);
    const message = extractJaegerError(payload) || `Jaeger 查询失败 (${response.status})`;
    throw new Error(message);
  }
  return parseJsonStream(text);
};

const parseJsonStream = (text: string): unknown => {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const chunks = trimmed
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
    return chunks.length === 1 ? chunks[0] : chunks;
  }
};

const extractJaegerError = (payload: unknown): string => {
  const record = asRecord(payload);
  const nestedError = asRecord(record?.error);
  return firstString(record?.message, record?.error, nestedError?.message, nestedError?.httpStatus);
};

const cleanLimit = (value: number): number => Math.min(200, Math.max(1, Math.trunc(value || 50)));

const windowToPromRange = (value: TraceWindow): string => {
  switch (value) {
    case "24h":
      return "24h";
    case "7d":
      return "7d";
    default:
      return "1h";
  }
};

const traceWindow = (windowValue: TraceWindow): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_TO_MS[windowValue]);
  return { start, end };
};

const kindAttributes = (kind: TraceKind): Record<string, string> => {
  switch (kind) {
    case "failure":
      return { error: "true" };
    case "timeout":
      return { "sea.timeout": "true" };
    case "slow":
      return { "sea.slow": "true" };
    default:
      return {};
  }
};

const legacyKindTags = (kind: TraceKind): Record<string, string> => {
  switch (kind) {
    case "failure":
      return { error: "true" };
    case "timeout":
      return { "sea.timeout": "true" };
    case "slow":
      return { "sea.slow": "true" };
    default:
      return {};
  }
};

export const fetchTraceServices = async (): Promise<string[]> => {
  try {
    const payload = await fetchJaeger("/api/v3/services");
    const services = asArray(asRecord(payload)?.services).map(asString).filter(Boolean);
    return services.sort((a, b) => a.localeCompare(b));
  } catch {
    const payload = await fetchJaeger("/api/services");
    const services = asArray(asRecord(payload)?.data).map(asString).filter(Boolean);
    return services.sort((a, b) => a.localeCompare(b));
  }
};

export const fetchTraceOperations = async (service: string): Promise<string[]> => {
  if (!service.trim()) {
    return [];
  }

  const encodedService = encodeURIComponent(service);
  try {
    const payload = await fetchJaeger(`/api/v3/operations?service=${encodedService}`);
    const operations = asArray(asRecord(payload)?.operations)
      .map((item) => {
        const record = asRecord(item);
        return firstString(record?.name, item);
      })
      .filter(Boolean);
    return Array.from(new Set(operations)).sort((a, b) => a.localeCompare(b));
  } catch {
    const payload = await fetchJaeger(`/api/operations?service=${encodedService}`);
    const operations = asArray(asRecord(payload)?.data)
      .map((item) => {
        const record = asRecord(item);
        return firstString(record?.name, item);
      })
      .filter(Boolean);
    return Array.from(new Set(operations)).sort((a, b) => a.localeCompare(b));
  }
};

export const searchTraces = async (params: TraceSearchParams): Promise<TraceSearchItem[]> => {
  const limit = cleanLimit(params.limit);
  const services = params.service?.trim()
    ? [params.service.trim()]
    : (await fetchTraceServices()).slice(0, MAX_SERVICE_FANOUT);

  if (!services.length) {
    return [];
  }

  const results = await Promise.all(
    services.map(async (service) => {
      try {
        return {
          ok: true as const,
          traces: await searchServiceTraceSummaries(service, { ...params, limit }),
        };
      } catch (error) {
        return { ok: false as const, error };
      }
    }),
  );
  const failures = results.filter((result) => !result.ok);
  if (failures.length === results.length) {
    const error = failures[0]?.error;
    throw error instanceof Error ? error : new Error("Jaeger 服务暂时不可用");
  }

  const deduped = new Map<string, TraceSearchItem>();
  for (const trace of results.flatMap((result) => (result.ok ? result.traces : []))) {
    const existing = deduped.get(trace.trace_id);
    if (
      !existing ||
      trace.error_span_count > existing.error_span_count ||
      trace.span_count > existing.span_count
    ) {
      deduped.set(trace.trace_id, trace);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      try {
        return Number(BigInt(right.start_time_unix_nano) - BigInt(left.start_time_unix_nano));
      } catch {
        return 0;
      }
    })
    .slice(0, limit);
};

export const fetchTraceSuccessSummary = async (
  params: Omit<TraceSearchParams, "kind">,
): Promise<TraceSuccessSummary> => {
  const [prometheus, allTraces, failureTraces, timeoutTraces, slowTraces] = await Promise.all([
    fetchPrometheusSuccessSummary(params.window),
    searchTraces({ ...params, kind: "all" }).catch(() => []),
    searchTraces({ ...params, kind: "failure" }).catch(() => []),
    searchTraces({ ...params, kind: "timeout" }).catch(() => []),
    searchTraces({ ...params, kind: "slow" }).catch(() => []),
  ]);

  const sampleTotal = allTraces.length;
  const failureTraceIds = new Set(failureTraces.map((trace) => trace.trace_id).filter(Boolean));
  const explicitFailureTraceIds = new Set(
    allTraces
      .filter((trace) => trace.error_span_count > 0 || failureTraceIds.has(trace.trace_id))
      .map((trace) => trace.trace_id)
      .filter(Boolean),
  );
  const sampleFailureCount =
    explicitFailureTraceIds.size > 0
      ? explicitFailureTraceIds.size
      : Math.min(sampleTotal, failureTraceIds.size);
  const sampleSuccessCount = Math.max(0, sampleTotal - sampleFailureCount);
  const latencyIds = new Set([
    ...timeoutTraces.map((trace) => trace.trace_id),
    ...slowTraces.map((trace) => trace.trace_id),
  ]);

  return {
    prometheus,
    jaeger: {
      sample_success_rate: sampleTotal > 0 ? sampleSuccessCount / sampleTotal : null,
      sample_total: sampleTotal,
      failure_count: failureTraces.length,
      latency_count: latencyIds.size,
    },
  };
};

const fetchPrometheusSuccessSummary = async (
  windowValue: TraceWindow,
): Promise<TraceSuccessSummary["prometheus"]> => {
  const reco = await fetchPrometheusRequestSummary("genrec_reco_requests_total", windowValue);
  if (reco.total_requests > 0) {
    return reco;
  }
  return fetchPrometheusRequestSummary("genrec_agent_requests_total", windowValue);
};

const fetchPrometheusRequestSummary = async (
  metric: string,
  windowValue: TraceWindow,
): Promise<TraceSuccessSummary["prometheus"]> => {
  const range = windowToPromRange(windowValue);
  const [totalIncrease, failedIncrease, totalInstant, failedInstant] = await Promise.all([
    queryPrometheusValue(`sum(increase(${metric}[${range}]))`),
    queryPrometheusValue(`sum(increase(${metric}{status="error"}[${range}]))`),
    queryPrometheusValue(`sum(${metric})`),
    queryPrometheusValue(`sum(${metric}{status="error"})`),
  ]);
  const totalRequests = totalIncrease > 0 ? totalIncrease : totalInstant;
  const failedRequests = totalIncrease > 0 ? failedIncrease : failedInstant;
  const successRequests = Math.max(0, totalRequests - failedRequests);
  return {
    success_rate: totalRequests > 0 ? successRequests / totalRequests : null,
    total_requests: totalRequests,
    failed_requests: failedRequests,
    metric,
  };
};

const queryPrometheusValue = async (query: string): Promise<number> => {
  const prometheusUrl = getPrometheusUrl();
  if (!prometheusUrl) {
    return 0;
  }

  const response = await fetch(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return 0;
  }

  const payload = asRecord(await response.json().catch(() => null));
  const result = asArray(asRecord(payload?.data)?.result);
  const firstResult = asRecord(result[0]);
  const value = asArray(firstResult?.value)[1];
  return asNumber(value);
};

const searchServiceTraceSummaries = async (
  service: string,
  params: TraceSearchParams,
): Promise<TraceSearchItem[]> => {
  try {
    return await searchServiceTraceSummariesV3(service, params);
  } catch {
    return searchServiceTraceSummariesLegacy(service, params);
  }
};

const searchServiceTraceSummariesV3 = async (
  service: string,
  params: TraceSearchParams,
): Promise<TraceSearchItem[]> => {
  const { start, end } = traceWindow(params.window);
  const query: Record<string, unknown> = {
    service_name: service,
    start_time_min: start.toISOString(),
    start_time_max: end.toISOString(),
    search_depth: params.limit,
  };

  if (params.operation?.trim()) {
    query.operation_name = params.operation.trim();
  }

  const attrs = kindAttributes(params.kind);
  if (Object.keys(attrs).length) {
    query.attributes = attrs;
  }

  if (params.kind === "slow") {
    query.duration_min = `${getSlowThresholdMs()}ms`;
  }

  const payload = await fetchV3TraceSummaries(query);

  return collectV3Summaries(payload).map((summary) => normalizeV3Summary(summary, params.kind));
};

const fetchV3TraceSummaries = async (query: Record<string, unknown>): Promise<unknown> => {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    search.set(`query.${key}`, key === "attributes" ? JSON.stringify(value) : String(value));
  });

  try {
    return await fetchJaeger(`/api/v3/trace-summaries?${search.toString()}`);
  } catch {
    return fetchJaeger("/api/v3/trace-summaries", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }
};

const collectV3Summaries = (payload: unknown): Record<string, unknown>[] => {
  const chunks = Array.isArray(payload) ? payload : [payload];
  const summaries: Record<string, unknown>[] = [];
  for (const chunk of chunks) {
    const record = asRecord(chunk);
    const result = asRecord(record?.result);
    for (const item of asArray(record?.summaries ?? result?.summaries)) {
      const summary = asRecord(item);
      if (summary) {
        summaries.push(summary);
      }
    }
  }
  return summaries;
};

const normalizeV3Summary = (summary: Record<string, unknown>, kind: TraceKind): TraceSearchItem => {
  const traceId = firstString(summary.trace_id, summary.traceId);
  const startNano = firstString(summary.min_start_time_unix_nano, summary.minStartTimeUnixNano);
  const endNano = firstString(summary.max_end_time_unix_nano, summary.maxEndTimeUnixNano);
  const services = asArray(summary.services).map((item) => {
    const record = asRecord(item) ?? {};
    return {
      name: firstString(record.name),
      span_count: asNumber(record.span_count ?? record.spanCount),
      error_span_count: asNumber(record.error_span_count ?? record.errorSpanCount),
    };
  });

  return {
    trace_id: traceId,
    root_service_name: firstString(summary.root_service_name, summary.rootServiceName),
    root_operation_name: firstString(summary.root_operation_name, summary.rootOperationName),
    start_time_unix_nano: startNano,
    duration_ms: nanoDurationMs(startNano, endNano),
    span_count: asNumber(summary.span_count ?? summary.spanCount),
    error_span_count: asNumber(summary.error_span_count ?? summary.errorSpanCount),
    services,
    matched_kind: kind,
    jaeger_url: buildJaegerTraceUrl(traceId),
  };
};

const searchServiceTraceSummariesLegacy = async (
  service: string,
  params: TraceSearchParams,
): Promise<TraceSearchItem[]> => {
  const search = new URLSearchParams();
  search.set("service", service);
  search.set("lookback", params.window);
  search.set("limit", String(params.limit));

  if (params.operation?.trim()) {
    search.set("operation", params.operation.trim());
  }

  const tags = legacyKindTags(params.kind);
  if (Object.keys(tags).length) {
    search.set("tags", JSON.stringify(tags));
  }

  if (params.kind === "slow") {
    search.set("minDuration", `${getSlowThresholdMs()}ms`);
  }

  const payload = await fetchJaeger(`/api/traces?${search.toString()}`);
  return asArray(asRecord(payload)?.data)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((trace) => normalizeLegacyTraceSummary(trace, params.kind));
};

const normalizeLegacyTraceSummary = (
  trace: Record<string, unknown>,
  kind: TraceKind,
): TraceSearchItem => {
  const spans = asArray(trace.spans)
    .map((item) => asRecord(item))
    .filter(Boolean);
  const processes = asRecord(trace.processes) ?? {};
  const rootSpan = findLegacyRootSpan(spans);
  const rootProcess = asRecord(processes[firstString(rootSpan?.processID)]);
  const traceId = firstString(trace.traceID, trace.trace_id);
  const startMicros = Math.min(...spans.map((span) => asNumber(span?.startTime)).filter(Boolean));
  const endMicros = Math.max(
    ...spans.map((span) => asNumber(span?.startTime) + asNumber(span?.duration)).filter(Boolean),
  );
  const services = legacyServiceSummaries(spans, processes);

  return {
    trace_id: traceId,
    root_service_name: firstString(rootProcess?.serviceName, services[0]?.name),
    root_operation_name: firstString(rootSpan?.operationName),
    start_time_unix_nano: Number.isFinite(startMicros)
      ? (BigInt(Math.trunc(startMicros)) * BigInt(1000)).toString()
      : "0",
    duration_ms:
      Number.isFinite(startMicros) && Number.isFinite(endMicros)
        ? (endMicros - startMicros) / 1000
        : 0,
    span_count: spans.length,
    error_span_count: spans.filter((span) => hasLegacyError(span)).length,
    services,
    matched_kind: kind,
    jaeger_url: buildJaegerTraceUrl(traceId),
  };
};

const findLegacyRootSpan = (
  spans: Array<Record<string, unknown> | null>,
): Record<string, unknown> | null => {
  const spanIds = new Set(spans.map((span) => firstString(span?.spanID, span?.span_id)));
  return (
    spans.find((span) => {
      const refs = asArray(span?.references);
      return !refs.some((ref) => spanIds.has(firstString(asRecord(ref)?.spanID)));
    }) ??
    spans
      .filter((span): span is Record<string, unknown> => Boolean(span))
      .sort((left, right) => asNumber(left.startTime) - asNumber(right.startTime))[0] ??
    null
  );
};

const legacyTags = (span: Record<string, unknown> | null): Record<string, string> => {
  const tags: Record<string, string> = {};
  for (const tag of asArray(span?.tags)) {
    const record = asRecord(tag);
    const key = firstString(record?.key);
    if (key) {
      tags[key] = String(record?.value ?? "");
    }
  }
  return tags;
};

const hasLegacyError = (span: Record<string, unknown> | null): boolean =>
  boolish(legacyTags(span).error);

const legacyServiceSummaries = (
  spans: Array<Record<string, unknown> | null>,
  processes: Record<string, unknown>,
): TraceServiceSummary[] => {
  const aggregate = new Map<string, TraceServiceSummary>();
  for (const span of spans) {
    const process = asRecord(processes[firstString(span?.processID)]);
    const serviceName = firstString(process?.serviceName, "unknown");
    const current = aggregate.get(serviceName) ?? {
      name: serviceName,
      span_count: 0,
      error_span_count: 0,
    };
    current.span_count += 1;
    if (hasLegacyError(span)) {
      current.error_span_count += 1;
    }
    aggregate.set(serviceName, current);
  }
  return Array.from(aggregate.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const fetchTraceDetail = async (traceId: string): Promise<TraceDetail> => {
  try {
    const payload = await fetchJaeger(`/api/v3/traces/${encodeURIComponent(traceId)}`);
    return {
      trace_id: traceId,
      jaeger_url: buildJaegerTraceUrl(traceId),
      spans: normalizeV3TraceSpans(payload),
      raw: payload,
    };
  } catch {
    const payload = await fetchJaeger(`/api/traces/${encodeURIComponent(traceId)}`);
    return {
      trace_id: traceId,
      jaeger_url: buildJaegerTraceUrl(traceId),
      spans: normalizeLegacyTraceSpans(payload),
      raw: payload,
    };
  }
};

const normalizeV3TraceSpans = (payload: unknown): TraceSpanItem[] => {
  const spans: TraceSpanItem[] = [];

  const chunks = Array.isArray(payload) ? payload : [payload];
  for (const chunk of chunks) {
    const record = asRecord(chunk);
    const result = asRecord(record?.result) ?? record ?? {};
    for (const resourceSpan of asArray(result.resourceSpans)) {
      const resourceRecord = asRecord(resourceSpan);
      const resourceAttrs = otlpAttributes(asRecord(resourceRecord?.resource)?.attributes);
      const serviceName = firstString(resourceAttrs["service.name"], "unknown");
      for (const scopeSpan of asArray(resourceRecord?.scopeSpans)) {
        const scopeRecord = asRecord(scopeSpan);
        for (const span of asArray(scopeRecord?.spans)) {
          const spanRecord = asRecord(span);
          if (!spanRecord) {
            continue;
          }
          const attrs = { ...resourceAttrs, ...otlpAttributes(spanRecord.attributes) };
          const startNano = firstString(
            spanRecord.startTimeUnixNano,
            spanRecord.start_time_unix_nano,
          );
          const endNano = firstString(spanRecord.endTimeUnixNano, spanRecord.end_time_unix_nano);
          const status = asRecord(spanRecord.status);
          const rawStatusCode = asNumber(status?.code);
          const statusMessage = firstString(status?.message);
          const statusCode =
            rawStatusCode === 2 ? "ERROR" : rawStatusCode === 1 ? "OK" : statusMessage;
          if (statusMessage) {
            attrs["otel.status_description"] = statusMessage;
          }
          spans.push({
            span_id: firstString(spanRecord.spanId, spanRecord.span_id),
            parent_span_id: firstString(spanRecord.parentSpanId, spanRecord.parent_span_id),
            service_name: serviceName,
            operation_name: firstString(spanRecord.name),
            start_time_unix_nano: startNano,
            duration_ms: nanoDurationMs(startNano, endNano),
            status_code: statusCode,
            error:
              boolish(attrs.error) || rawStatusCode === 2 || statusCode === "STATUS_CODE_ERROR",
            timeout: boolish(attrs["sea.timeout"]),
            slow: boolish(attrs["sea.slow"]),
            attributes: attrs,
          });
        }
      }
    }
  }

  return spans.sort((left, right) => {
    try {
      return Number(BigInt(left.start_time_unix_nano) - BigInt(right.start_time_unix_nano));
    } catch {
      return 0;
    }
  });
};

const otlpAttributes = (value: unknown): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const attr of asArray(value)) {
    const record = asRecord(attr);
    const key = firstString(record?.key);
    if (key) {
      attrs[key] = otlpValueToString(record?.value);
    }
  }
  return attrs;
};

const otlpValueToString = (value: unknown): string => {
  const record = asRecord(value);
  if (!record) {
    return String(value ?? "");
  }
  for (const key of ["stringValue", "boolValue", "intValue", "doubleValue", "bytesValue"]) {
    if (record[key] !== undefined) {
      return String(record[key]);
    }
  }
  return JSON.stringify(record);
};

const normalizeLegacyTraceSpans = (payload: unknown): TraceSpanItem[] => {
  const traces = asArray(asRecord(payload)?.data);
  const trace = asRecord(traces[0]) ?? asRecord(payload) ?? {};
  const processes = asRecord(trace.processes) ?? {};

  return asArray(trace.spans)
    .map((item) => asRecord(item))
    .filter((span): span is Record<string, unknown> => Boolean(span))
    .map((span) => {
      const tags = legacyTags(span);
      const process = asRecord(processes[firstString(span.processID)]);
      const parentSpanId = firstString(asRecord(asArray(span.references)[0])?.spanID);
      const startNano = numberToNanoString(span.startTime, BigInt(1000));
      const durationNano = BigInt(Math.trunc(asNumber(span.duration))) * BigInt(1000);
      const endNano = (BigInt(startNano) + durationNano).toString();
      return {
        span_id: firstString(span.spanID),
        parent_span_id: parentSpanId,
        service_name: firstString(process?.serviceName, "unknown"),
        operation_name: firstString(span.operationName),
        start_time_unix_nano: startNano,
        duration_ms: nanoDurationMs(startNano, endNano),
        status_code: boolish(tags.error) ? "ERROR" : "OK",
        error: boolish(tags.error),
        timeout: boolish(tags["sea.timeout"]),
        slow: boolish(tags["sea.slow"]),
        attributes: tags,
      };
    })
    .sort((left, right) => {
      try {
        return Number(BigInt(left.start_time_unix_nano) - BigInt(right.start_time_unix_nano));
      } catch {
        return 0;
      }
    });
};
