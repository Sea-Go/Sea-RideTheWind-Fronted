export type TravelAgentMode = "chat" | "map_revealing" | "map" | "chat_overlay";
export type PlanningLevel = "overview" | "phase" | "month" | "week" | "day";

export type PlanningEventType =
  | "chat_message_delta"
  | "planning_stage_changed"
  | "map_scope_changed"
  | "map_point_added"
  | "map_point_updated"
  | "map_point_soft_deleted"
  | "route_candidate_added"
  | "route_candidate_updated"
  | "route_selected"
  | "route_dimmed"
  | "map_annotation_added"
  | "map_annotation_updated"
  | "map_annotation_dimmed"
  | "map_batch"
  | "planning_completed"
  | "planning_error";

export interface TravelChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
}

export interface MapPoint {
  lng: number;
  lat: number;
  label: string;
  kind: string;
  accuracy?: string;
  source?: string;
  address?: string;
  city?: string;
  district?: string;
  category?: string;
  description?: string;
  notes?: string;
  visitOrder?: number;
  startTime?: string;
  endTime?: string;
  durationMin?: number;
  estimatedCost?: number;
  phaseId?: string;
  phaseSeq?: number;
  phaseName?: string;
  dayId?: string;
  dayIndex?: number;
}

export interface MapPopup {
  title: string;
  content: string;
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

export interface MapRoute {
  id: string;
  label: string;
  status: string;
  mode: string;
  accuracy?: "exact" | "connector" | "directional" | string;
  source?: "amap_driving" | "exact_point_connector" | "macro_anchor" | string;
  phaseId?: string;
  phaseSeq?: number;
  phaseName?: string;
  dayId?: string;
  dayIndex?: number;
  segmentIndex?: number;
  fromNodeId?: string;
  toNodeId?: string;
  connectionType?: "day_segment" | "cross_day" | "phase" | string;
  distanceMeters?: number;
  durationMin?: number;
  estimatedCost?: number;
  polyline?: Array<[number, number]>;
  reason?: string;
  score?: number;
}

export interface MapAnnotationAnchor {
  type: "point" | "route" | "scope" | string;
  nodeId?: string;
  routeId?: string;
  label?: string;
  point?: MapPoint;
}

export interface MapAnnotation {
  id: string;
  kind: string;
  source?: string;
  title: string;
  summary?: string;
  url?: string;
  authorName?: string;
  score?: number;
  status: string;
  tags?: string[];
  reasons?: string[];
  evidence?: string[];
  anchor: MapAnnotationAnchor;
}

export interface MapPointState {
  id: string;
  level: PlanningLevel;
  status: string;
  point: MapPoint;
  popup?: MapPopup;
  reason?: string;
}

export interface MapRouteState {
  id: string;
  level: PlanningLevel;
  status: string;
  route: MapRoute;
  reason?: string;
}

export interface MapAnnotationState {
  id: string;
  level: PlanningLevel;
  status: string;
  annotation: MapAnnotation;
  reason?: string;
}

export interface MapAnnotationFilters {
  zhihu: boolean;
  thought: boolean;
  decision: boolean;
  review: boolean;
  rejected: boolean;
}

export interface PublicPlanningEvent {
  type: PlanningEventType;
  runId: string;
  seq: number;
  level?: PlanningLevel;
  nodeId?: string;
  routeId?: string;
  stage?: string;
  status?: string;
  publicAction?: string;
  thoughtSummary?: string;
  recordedFacts?: string[];
  point?: MapPoint;
  popup?: MapPopup;
  viewport?: MapViewport;
  route?: MapRoute;
  annotation?: MapAnnotation;
  reason?: string;
  message?: string;
  events?: PublicPlanningEvent[];
  usage?: ModelUsage;
  createdAt?: string;
}

export interface ModelUsage {
  agentLabel?: string;
  model?: string;
  modelLevel?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface MapPlanningState {
  activeLevel: PlanningLevel;
  focusedNodeId?: string;
  viewport?: MapViewport;
  points: Record<string, MapPointState>;
  routes: Record<string, MapRouteState>;
  annotations: Record<string, MapAnnotationState>;
  annotationFilters: MapAnnotationFilters;
  showDimmed: boolean;
}

export interface TravelStreamRequest {
  threadId: string;
  runId: string;
  userId?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface TravelRunSummary {
  runId: string;
  threadId: string;
  title: string;
  status: string;
  stage: string;
  lastMessage: string;
  finalSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelHistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
  createdAt?: string;
}

export interface TravelRunDetail {
  run: TravelRunSummary;
  messages: TravelHistoryMessage[];
  events: PublicPlanningEvent[];
  mapSnapshot: MapPlanningState;
  finalResult: string;
}

export interface TravelRunHistoryResponse {
  runs: TravelRunSummary[];
  nextCursor?: string;
}

export interface ThinkingTimelineEntry {
  id: string;
  seq: number;
  type: PlanningEventType;
  title: string;
  summary: string;
  status: string;
  kind: string;
  source?: string;
  createdAt: string;
  timestampMs: number;
  nodeId?: string;
  routeId?: string;
  recordedFacts?: string[];
  annotation?: MapAnnotation;
  usage?: ModelUsage;
}

export interface ThinkingTimelineUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  models: string[];
  agentLabels: string[];
}

export interface ThinkingTimelineStep {
  id: string;
  index: number;
  title: string;
  summary: string;
  status: string;
  stage?: string;
  level?: PlanningLevel;
  nodeId?: string;
  routeId?: string;
  startedAt: string;
  endedAt?: string;
  startMs: number;
  endMs?: number;
  durationMs: number;
  usage: ThinkingTimelineUsage;
  entries: ThinkingTimelineEntry[];
}

export interface ThinkingTimeline {
  steps: ThinkingTimelineStep[];
  totalDurationMs: number;
  currentStepDurationMs: number;
  completedStepCount: number;
  startedAt?: string;
  endedAt?: string;
}

export const createInitialMapState = (): MapPlanningState => ({
  activeLevel: "overview",
  points: {},
  routes: {},
  annotations: {},
  annotationFilters: {
    zhihu: true,
    thought: true,
    decision: true,
    review: true,
    rejected: true,
  },
  showDimmed: true,
});

export const applyPlanningEvent = (
  state: MapPlanningState,
  event: PublicPlanningEvent,
): MapPlanningState => {
  if (event.type === "map_batch") {
    return (event.events ?? []).reduce(applyPlanningEvent, state);
  }

  if (event.type === "map_scope_changed") {
    const nextLevel = event.level ?? state.activeLevel;
    const nextViewport = event.viewport ?? state.viewport;
    const nextFocusedNodeId = event.nodeId ?? state.focusedNodeId;
    if (
      nextLevel === state.activeLevel &&
      nextFocusedNodeId === state.focusedNodeId &&
      mapViewportSignature(nextViewport) === mapViewportSignature(state.viewport)
    ) {
      return state;
    }
    return {
      ...state,
      activeLevel: nextLevel,
      viewport: nextViewport,
      focusedNodeId: nextFocusedNodeId,
    };
  }

  if (
    event.type === "map_point_added" ||
    event.type === "map_point_updated" ||
    event.type === "map_point_soft_deleted"
  ) {
    if (!event.nodeId || !isExactRenderablePoint(event.point)) {
      return state;
    }
    const status = event.type === "map_point_soft_deleted" ? "dimmed" : event.status || "active";
    return {
      ...state,
      points: {
        ...state.points,
        [event.nodeId]: {
          id: event.nodeId,
          level: event.level ?? state.activeLevel,
          status,
          point: event.point,
          popup: event.popup,
          reason: event.reason,
        },
      },
      focusedNodeId: event.nodeId,
    };
  }

  if (
    event.type === "route_candidate_added" ||
    event.type === "route_candidate_updated" ||
    event.type === "route_selected" ||
    event.type === "route_dimmed"
  ) {
    const routeId = event.routeId ?? event.route?.id;
    if (!routeId || !event.route) {
      return state;
    }
    const status =
      event.type === "route_selected"
        ? "selected"
        : event.type === "route_dimmed"
          ? "dimmed"
          : event.route.status || event.status || "candidate";
    return {
      ...state,
      routes: {
        ...state.routes,
        [routeId]: {
          id: routeId,
          level: event.level ?? state.activeLevel,
          status,
          route: { ...event.route, status },
          reason: event.reason ?? event.route.reason,
        },
      },
    };
  }

  if (
    event.type === "map_annotation_added" ||
    event.type === "map_annotation_updated" ||
    event.type === "map_annotation_dimmed"
  ) {
    if (!event.annotation?.id) {
      return state;
    }
    const status =
      event.type === "map_annotation_dimmed"
        ? "dimmed"
        : event.status || event.annotation.status || "active";
    return {
      ...state,
      annotations: {
        ...state.annotations,
        [event.annotation.id]: {
          id: event.annotation.id,
          level: event.level ?? state.activeLevel,
          status,
          annotation: {
            ...event.annotation,
            status,
          },
          reason: event.reason,
        },
      },
    };
  }

  return state;
};

export const hydrateMapStateFromEvents = (events: PublicPlanningEvent[]): MapPlanningState =>
  events.reduce(applyPlanningEvent, createInitialMapState());

export const appendThinkingEvent = (
  events: PublicPlanningEvent[],
  event: PublicPlanningEvent,
  receivedAtMs = Date.now(),
): PublicPlanningEvent[] => [...events, withEventReceiveTime(event, receivedAtMs)];

export const buildThinkingTimelineFromEvents = (
  events: PublicPlanningEvent[],
  nowMs = Date.now(),
): ThinkingTimeline => {
  const flatEvents = flattenPlanningEvents(events)
    .filter(isTimelineEvent)
    .sort((left, right) => {
      if (left.seq !== right.seq) {
        return left.seq - right.seq;
      }
      return eventTimestampMs(left, nowMs) - eventTimestampMs(right, nowMs);
    });

  const steps: ThinkingTimelineStep[] = [];
  let currentStep: ThinkingTimelineStep | undefined;

  for (const event of flatEvents) {
    const timestampMs = eventTimestampMs(event, nowMs);
    const entry = timelineEntryFromEvent(event, timestampMs);
    if (!entry) {
      continue;
    }

    if (!currentStep || shouldStartTimelineStep(event, currentStep)) {
      currentStep = {
        id: timelineStepId(event, steps.length + 1),
        index: steps.length + 1,
        title: timelineStepTitle(event, entry),
        summary: entry.summary,
        status: timelineStepStatus(event),
        stage: event.stage,
        level: event.level,
        nodeId: event.nodeId || event.annotation?.anchor.nodeId,
        routeId: event.routeId || event.annotation?.anchor.routeId,
        startedAt: entry.createdAt,
        startMs: timestampMs,
        durationMs: 0,
        usage: createEmptyTimelineUsage(),
        entries: [],
      };
      steps.push(currentStep);
    }

    currentStep.entries.push(entry);
    mergeTimelineUsage(currentStep.usage, entry.usage);
    currentStep.status = mergeTimelineStatus(currentStep.status, timelineStepStatus(event));
    currentStep.summary = currentStep.summary || entry.summary;
    currentStep.nodeId = currentStep.nodeId || entry.nodeId;
    currentStep.routeId = currentStep.routeId || entry.routeId;
  }

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const nextStep = steps[index + 1];
    const lastEntry = step.entries[step.entries.length - 1];
    const isTerminal = step.status === "completed" || step.status === "failed";
    const endMs = nextStep?.startMs ?? (isTerminal ? lastEntry?.timestampMs : undefined);
    step.endMs = endMs;
    step.endedAt = endMs ? new Date(endMs).toISOString() : undefined;
    if (nextStep && step.status !== "failed") {
      step.status = "completed";
    }
    step.durationMs = Math.max(0, (endMs ?? nowMs) - step.startMs);
  }

  const first = steps[0];
  const last = steps[steps.length - 1];
  const totalDurationMs = first ? Math.max(0, (last?.endMs ?? nowMs) - first.startMs) : 0;
  const currentStepDurationMs =
    last && last.status !== "completed" && last.status !== "failed"
      ? Math.max(0, nowMs - last.startMs)
      : 0;

  return {
    steps,
    totalDurationMs,
    currentStepDurationMs,
    completedStepCount: steps.filter((step) => step.status === "completed").length,
    startedAt: first?.startedAt,
    endedAt: last?.endedAt,
  };
};

export const fetchTravelRunHistory = async ({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<TravelRunHistoryResponse> => {
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  if (cursor) {
    search.set("cursor", cursor);
  }

  const response = await fetch(`/api/travel-agent/runs?${search.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`旅行规划历史暂时不可用：${response.status}`);
  }

  const payload = asRecord(await response.json());
  const runs = Array.isArray(payload?.runs) ? payload.runs.map(normalizeRunSummary) : [];
  const nextCursor = typeof payload?.nextCursor === "string" ? payload.nextCursor : undefined;
  return { runs, nextCursor };
};

export const fetchTravelRunDetail = async (runId: string): Promise<TravelRunDetail> => {
  const response = await fetch(`/api/travel-agent/runs/${encodeURIComponent(runId)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`旅行规划详情暂时不可用：${response.status}`);
  }

  const payload = asRecord(await response.json());
  const events = Array.isArray(payload?.events)
    ? payload.events.map((event) => event as PublicPlanningEvent)
    : [];
  const mapSnapshot =
    normalizeMapSnapshot(payload?.mapSnapshot) ?? hydrateMapStateFromEvents(events);
  return {
    run: normalizeRunSummary(payload?.run),
    messages: Array.isArray(payload?.messages)
      ? payload.messages.map(normalizeHistoryMessage).filter((message) => message.content.trim())
      : [],
    events,
    mapSnapshot,
    finalResult: typeof payload?.finalResult === "string" ? payload.finalResult : "",
  };
};

export const streamTravelAgent = async (
  payload: TravelStreamRequest,
  options: {
    signal?: AbortSignal;
    onEvent: (event: PublicPlanningEvent) => void;
  },
): Promise<void> => {
  const response = await fetch("/api/travel-agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`旅行规划服务暂时不可用：${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSSEEvent(rawEvent);
      if (parsed) {
        options.onEvent(parsed);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
};

const PLANNING_LEVELS: PlanningLevel[] = ["overview", "phase", "month", "week", "day"];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const textOf = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const normalizeRunSummary = (value: unknown): TravelRunSummary => {
  const record = asRecord(value);
  return {
    runId: textOf(record?.runId),
    threadId: textOf(record?.threadId),
    title: textOf(record?.title, "旅行规划"),
    status: textOf(record?.status, "running"),
    stage: textOf(record?.stage, "requirement_intake"),
    lastMessage: textOf(record?.lastMessage),
    finalSummary: textOf(record?.finalSummary),
    createdAt: textOf(record?.createdAt),
    updatedAt: textOf(record?.updatedAt),
  };
};

const normalizeHistoryMessage = (value: unknown): TravelHistoryMessage => {
  const record = asRecord(value);
  const role = record?.role === "user" ? "user" : "assistant";
  const rawStatus = textOf(record?.status, "done");
  const status =
    rawStatus === "streaming" || rawStatus === "error" || rawStatus === "done" ? rawStatus : "done";
  return {
    id: textOf(record?.id, `history-${role}-${Date.now()}-${Math.random()}`),
    role,
    content: textOf(record?.content),
    status,
    createdAt: textOf(record?.createdAt),
  };
};

const withEventReceiveTime = (
  event: PublicPlanningEvent,
  receivedAtMs: number,
): PublicPlanningEvent => {
  const createdAt = event.createdAt || new Date(receivedAtMs).toISOString();
  return {
    ...event,
    createdAt,
    events: event.events?.map((child, index) => ({
      ...child,
      runId: child.runId || event.runId,
      seq: child.seq || event.seq + (index + 1) / 1000,
      createdAt: child.createdAt || createdAt,
    })),
  };
};

const flattenPlanningEvents = (events: PublicPlanningEvent[]): PublicPlanningEvent[] => {
  const out: PublicPlanningEvent[] = [];
  events.forEach((event) => {
    if (event.type === "map_batch") {
      out.push(event);
      event.events?.forEach((child, index) => {
        out.push({
          ...child,
          runId: child.runId || event.runId,
          seq: child.seq || event.seq + (index + 1) / 1000,
          createdAt: child.createdAt || event.createdAt,
        });
      });
      return;
    }
    out.push(event);
  });
  return out;
};

const isTimelineEvent = (event: PublicPlanningEvent): boolean => {
  if (event.type === "chat_message_delta") {
    return false;
  }
  return Boolean(
    event.publicAction ||
    event.thoughtSummary ||
    event.recordedFacts?.length ||
    event.annotation ||
    event.type === "planning_completed" ||
    event.type === "planning_error",
  );
};

const timelineEntryFromEvent = (
  event: PublicPlanningEvent,
  timestampMs: number,
): ThinkingTimelineEntry | null => {
  const annotation = event.annotation;
  const title =
    event.publicAction ||
    annotation?.title ||
    event.route?.label ||
    event.point?.label ||
    timelineFallbackTitle(event);
  const summary =
    event.thoughtSummary ||
    annotation?.summary ||
    event.reason ||
    event.message ||
    event.popup?.content ||
    "";
  if (!title && !summary) {
    return null;
  }

  return {
    id: [
      event.seq,
      event.type,
      event.nodeId || annotation?.anchor.nodeId || "",
      event.routeId || annotation?.anchor.routeId || "",
      annotation?.id || "",
    ].join(":"),
    seq: event.seq,
    type: event.type,
    title,
    summary,
    status: event.status || annotation?.status || event.route?.status || "active",
    kind: annotationKindForTimeline(event),
    source: annotation?.source,
    createdAt: event.createdAt || new Date(timestampMs).toISOString(),
    timestampMs,
    nodeId: event.nodeId || annotation?.anchor.nodeId,
    routeId: event.routeId || annotation?.anchor.routeId,
    recordedFacts: event.recordedFacts,
    annotation,
    usage: event.usage,
  };
};

const createEmptyTimelineUsage = (): ThinkingTimelineUsage => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  models: [],
  agentLabels: [],
});

const mergeTimelineUsage = (target: ThinkingTimelineUsage, usage?: ModelUsage) => {
  if (!usage) {
    return;
  }
  target.promptTokens += usage.promptTokens || 0;
  target.completionTokens += usage.completionTokens || 0;
  target.totalTokens += usage.totalTokens || 0;
  if (usage.model && !target.models.includes(usage.model)) {
    target.models.push(usage.model);
  }
  if (usage.agentLabel && !target.agentLabels.includes(usage.agentLabel)) {
    target.agentLabels.push(usage.agentLabel);
  }
};

const shouldStartTimelineStep = (
  event: PublicPlanningEvent,
  currentStep: ThinkingTimelineStep,
): boolean => {
  if (event.type === "planning_stage_changed" || event.type === "map_scope_changed") {
    return true;
  }
  if (event.type === "planning_completed" || event.type === "planning_error") {
    return true;
  }
  if (event.stage && event.stage !== currentStep.stage) {
    return true;
  }
  return false;
};

const timelineStepId = (event: PublicPlanningEvent, index: number): string =>
  [
    "step",
    index,
    event.stage || event.level || "planning",
    Math.floor(event.seq),
    event.nodeId || event.routeId || event.annotation?.id || "",
  ].join("-");

const timelineStepTitle = (event: PublicPlanningEvent, entry: ThinkingTimelineEntry): string => {
  if (event.type === "planning_completed") {
    return "规划完成";
  }
  if (event.type === "planning_error") {
    return "规划出错";
  }
  return entry.title || stageLabel(event.stage) || "规划步骤";
};

const timelineStepStatus = (event: PublicPlanningEvent): string => {
  if (event.type === "planning_completed") {
    return "completed";
  }
  if (event.type === "planning_error") {
    return "failed";
  }
  if (event.status === "completed" || event.status === "failed" || event.status === "waiting") {
    return event.status;
  }
  return "active";
};

const mergeTimelineStatus = (current: string, next: string): string => {
  if (next === "failed") {
    return "failed";
  }
  if (next === "completed") {
    return "completed";
  }
  if (current === "completed" || current === "failed") {
    return current;
  }
  if (next === "waiting") {
    return "waiting";
  }
  return "active";
};

const annotationKindForTimeline = (event: PublicPlanningEvent): string => {
  if (event.annotation?.kind) {
    return event.annotation.kind;
  }
  if (event.type.startsWith("route_")) {
    return "decision";
  }
  if (event.type === "planning_error") {
    return "error";
  }
  return "thought";
};

const timelineFallbackTitle = (event: PublicPlanningEvent): string => {
  if (event.type === "planning_completed") {
    return "规划完成";
  }
  if (event.type === "planning_error") {
    return "规划出错";
  }
  return stageLabel(event.stage) || event.type;
};

const stageLabel = (stage?: string): string => {
  const labels: Record<string, string> = {
    requirement_intake: "识别需求",
    awaiting_user_info: "等待补充信息",
    macro_planning: "建立大规划",
    graph_splitting: "拆分小规划",
    day_expansion: "展开日级地点和路线",
    review: "审核规划质量",
    final_output: "生成最终方案",
  };
  return stage ? labels[stage] || stage : "";
};

const eventTimestampMs = (event: PublicPlanningEvent, fallbackMs: number): number => {
  const value = event.createdAt ? Date.parse(event.createdAt) : Number.NaN;
  return Number.isFinite(value) ? value : fallbackMs;
};

const normalizePlanningLevel = (value: unknown): PlanningLevel =>
  typeof value === "string" && PLANNING_LEVELS.includes(value as PlanningLevel)
    ? (value as PlanningLevel)
    : "overview";

const isValidLngLat = (lng: number, lat: number): boolean =>
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  !(lng === 0 && lat === 0) &&
  lng >= -180 &&
  lng <= 180 &&
  lat >= -90 &&
  lat <= 90;

const isExactRenderablePoint = (point?: MapPoint): point is MapPoint =>
  Boolean(point && point.accuracy === "exact" && isValidLngLat(point.lng, point.lat));

const mapViewportSignature = (viewport?: MapViewport): string =>
  viewport ? `${viewport.center[0]},${viewport.center[1]},${viewport.zoom}` : "";

const normalizeViewport = (value: unknown): MapViewport | undefined => {
  const record = asRecord(value);
  const center = record?.center;
  const zoom = record?.zoom;
  if (
    Array.isArray(center) &&
    center.length >= 2 &&
    typeof center[0] === "number" &&
    typeof center[1] === "number" &&
    typeof zoom === "number"
  ) {
    return { center: [center[0], center[1]], zoom };
  }
  return undefined;
};

const normalizeMapSnapshot = (value: unknown): MapPlanningState | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const points: Record<string, MapPointState> = {};
  const rawPoints = asRecord(record.points);
  if (rawPoints) {
    for (const [id, rawPointState] of Object.entries(rawPoints)) {
      const pointState = normalizePointState(id, rawPointState);
      if (pointState) {
        points[id] = pointState;
      }
    }
  }

  const routes: Record<string, MapRouteState> = {};
  const rawRoutes = asRecord(record.routes);
  if (rawRoutes) {
    for (const [id, rawRouteState] of Object.entries(rawRoutes)) {
      const routeState = normalizeRouteState(id, rawRouteState);
      if (routeState) {
        routes[id] = routeState;
      }
    }
  }

  const annotations: Record<string, MapAnnotationState> = {};
  const rawAnnotations = asRecord(record.annotations);
  if (rawAnnotations) {
    for (const [id, rawAnnotationState] of Object.entries(rawAnnotations)) {
      const annotationState = normalizeAnnotationState(id, rawAnnotationState);
      if (annotationState) {
        annotations[id] = annotationState;
      }
    }
  }
  const rawFilters = asRecord(record.annotationFilters);

  return {
    activeLevel: normalizePlanningLevel(record.activeLevel),
    focusedNodeId: textOf(record.focusedNodeId) || undefined,
    viewport: normalizeViewport(record.viewport),
    points,
    routes,
    annotations,
    annotationFilters: {
      zhihu: typeof rawFilters?.zhihu === "boolean" ? rawFilters.zhihu : true,
      thought: typeof rawFilters?.thought === "boolean" ? rawFilters.thought : true,
      decision: typeof rawFilters?.decision === "boolean" ? rawFilters.decision : true,
      review: typeof rawFilters?.review === "boolean" ? rawFilters.review : true,
      rejected: typeof rawFilters?.rejected === "boolean" ? rawFilters.rejected : true,
    },
    showDimmed: typeof record.showDimmed === "boolean" ? record.showDimmed : true,
  };
};

const normalizeStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.map((item) => textOf(item)).filter((item) => item.trim())
    : undefined;

const normalizeAnnotationAnchor = (value: unknown): MapAnnotationAnchor => {
  const record = asRecord(value);
  const point = asRecord(record?.point);
  const normalizedPoint =
    point && typeof point.lng === "number" && typeof point.lat === "number"
      ? {
          lng: point.lng,
          lat: point.lat,
          label: textOf(point.label, "规划点"),
          kind: textOf(point.kind, "poi"),
          accuracy: textOf(point.accuracy) || undefined,
          source: textOf(point.source) || undefined,
          address: textOf(point.address) || undefined,
          city: textOf(point.city) || undefined,
          district: textOf(point.district) || undefined,
          category: textOf(point.category) || undefined,
          description: textOf(point.description) || undefined,
          notes: textOf(point.notes) || undefined,
          visitOrder: typeof point.visitOrder === "number" ? point.visitOrder : undefined,
          startTime: textOf(point.startTime) || undefined,
          endTime: textOf(point.endTime) || undefined,
          durationMin: typeof point.durationMin === "number" ? point.durationMin : undefined,
          estimatedCost: typeof point.estimatedCost === "number" ? point.estimatedCost : undefined,
        }
      : undefined;

  return {
    type: textOf(record?.type, "scope"),
    nodeId: textOf(record?.nodeId) || undefined,
    routeId: textOf(record?.routeId) || undefined,
    label: textOf(record?.label) || undefined,
    point: normalizedPoint,
  };
};

const normalizeAnnotationState = (id: string, value: unknown): MapAnnotationState | null => {
  const record = asRecord(value);
  const annotation = asRecord(record?.annotation);
  if (!record || !annotation) {
    return null;
  }
  const annotationId = textOf(annotation.id, id);
  if (!annotationId) {
    return null;
  }
  const status = textOf(record.status, textOf(annotation.status, "active"));

  return {
    id: textOf(record.id, annotationId),
    level: normalizePlanningLevel(record.level),
    status,
    annotation: {
      id: annotationId,
      kind: textOf(annotation.kind, "thought"),
      source: textOf(annotation.source) || undefined,
      title: textOf(annotation.title, "规划证据"),
      summary: textOf(annotation.summary) || undefined,
      url: textOf(annotation.url) || undefined,
      authorName: textOf(annotation.authorName) || undefined,
      score: typeof annotation.score === "number" ? annotation.score : undefined,
      status,
      tags: normalizeStringArray(annotation.tags),
      reasons: normalizeStringArray(annotation.reasons),
      evidence: normalizeStringArray(annotation.evidence),
      anchor: normalizeAnnotationAnchor(annotation.anchor),
    },
    reason: textOf(record.reason) || undefined,
  };
};

const normalizePointState = (id: string, value: unknown): MapPointState | null => {
  const record = asRecord(value);
  const point = asRecord(record?.point);
  if (!record || !point || typeof point.lng !== "number" || typeof point.lat !== "number") {
    return null;
  }
  const normalizedPoint: MapPoint = {
    lng: point.lng,
    lat: point.lat,
    label: textOf(point.label, "规划点"),
    kind: textOf(point.kind, "poi"),
    accuracy: textOf(point.accuracy) || undefined,
    source: textOf(point.source) || undefined,
    address: textOf(point.address) || undefined,
    city: textOf(point.city) || undefined,
    district: textOf(point.district) || undefined,
    category: textOf(point.category) || undefined,
    description: textOf(point.description) || undefined,
    notes: textOf(point.notes) || undefined,
    visitOrder: typeof point.visitOrder === "number" ? point.visitOrder : undefined,
    startTime: textOf(point.startTime) || undefined,
    endTime: textOf(point.endTime) || undefined,
    durationMin: typeof point.durationMin === "number" ? point.durationMin : undefined,
    estimatedCost: typeof point.estimatedCost === "number" ? point.estimatedCost : undefined,
    phaseId: textOf(point.phaseId) || undefined,
    phaseSeq: typeof point.phaseSeq === "number" ? point.phaseSeq : undefined,
    phaseName: textOf(point.phaseName) || undefined,
    dayId: textOf(point.dayId) || undefined,
    dayIndex: typeof point.dayIndex === "number" ? point.dayIndex : undefined,
  };
  if (!isExactRenderablePoint(normalizedPoint)) {
    return null;
  }
  const popup = asRecord(record.popup);
  return {
    id: textOf(record.id, id),
    level: normalizePlanningLevel(record.level),
    status: textOf(record.status, "active"),
    point: normalizedPoint,
    popup: popup
      ? {
          title: textOf(popup.title),
          content: textOf(popup.content),
        }
      : undefined,
    reason: textOf(record.reason) || undefined,
  };
};

const normalizeRouteState = (id: string, value: unknown): MapRouteState | null => {
  const record = asRecord(value);
  const route = asRecord(record?.route);
  if (!record || !route) {
    return null;
  }
  const polyline = Array.isArray(route.polyline)
    ? route.polyline
        .map((pair) => (Array.isArray(pair) ? pair : []))
        .filter(
          (pair): pair is [number, number] =>
            pair.length >= 2 && typeof pair[0] === "number" && typeof pair[1] === "number",
        )
    : undefined;

  return {
    id: textOf(record.id, id),
    level: normalizePlanningLevel(record.level),
    status: textOf(record.status, "candidate"),
    route: {
      id: textOf(route.id, id),
      label: textOf(route.label, "候选路线"),
      status: textOf(route.status, textOf(record.status, "candidate")),
      mode: textOf(route.mode, "drive"),
      accuracy: textOf(route.accuracy) || undefined,
      source: textOf(route.source) || undefined,
      phaseId: textOf(route.phaseId) || undefined,
      phaseSeq: typeof route.phaseSeq === "number" ? route.phaseSeq : undefined,
      phaseName: textOf(route.phaseName) || undefined,
      dayId: textOf(route.dayId) || undefined,
      dayIndex: typeof route.dayIndex === "number" ? route.dayIndex : undefined,
      segmentIndex: typeof route.segmentIndex === "number" ? route.segmentIndex : undefined,
      fromNodeId: textOf(route.fromNodeId) || undefined,
      toNodeId: textOf(route.toNodeId) || undefined,
      connectionType: textOf(route.connectionType) || undefined,
      distanceMeters: typeof route.distanceMeters === "number" ? route.distanceMeters : undefined,
      durationMin: typeof route.durationMin === "number" ? route.durationMin : undefined,
      estimatedCost: typeof route.estimatedCost === "number" ? route.estimatedCost : undefined,
      polyline,
      reason: textOf(route.reason) || undefined,
      score: typeof route.score === "number" ? route.score : undefined,
    },
    reason: textOf(record.reason) || undefined,
  };
};

const parseSSEEvent = (rawEvent: string): PublicPlanningEvent | null => {
  const data = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as PublicPlanningEvent;
  } catch {
    return null;
  }
};
