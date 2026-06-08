"use client";

import {
  BotIcon,
  ClockIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  LightbulbIcon,
  Loader2Icon,
  MapIcon,
  MessageCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  RouteIcon,
  ScaleIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MarkdownArticle } from "@/components/article/MarkdownArticle";
import {
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  resolveProfileThemeId,
} from "@/components/profile/profile-theme-config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  appendThinkingEvent,
  applyPlanningEvent,
  buildThinkingTimelineFromEvents,
  createInitialMapState,
  fetchTravelRunDetail,
  fetchTravelRunHistory,
  hydrateMapStateFromEvents,
  type MapAnnotationFilters,
  type MapAnnotationState,
  type MapPlanningState,
  type MapPointState,
  type MapRouteState,
  type PublicPlanningEvent,
  streamTravelAgent,
  type ThinkingTimeline,
  type ThinkingTimelineEntry,
  type ThinkingTimelineStep,
  type TravelAgentMode,
  type TravelChatMessage,
  type TravelRunSummary,
} from "@/services/travel-agent";

declare global {
  interface Window {
    AMap?: any;
    __travelAgentAmapLoading?: Promise<void>;
  }
}

const createId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
};

const getEventStatusLabel = (event?: PublicPlanningEvent) => {
  if (!event) {
    return "等待需求";
  }
  if (event.publicAction) {
    return event.publicAction;
  }
  if (event.type === "planning_completed") {
    return "规划完成";
  }
  if (event.type === "planning_error") {
    return "规划出错";
  }
  if (event.type === "chat_message_delta") {
    return "回复用户";
  }
  return event.stage || "地图更新";
};

const MAP_REVEAL_DURATION_MS = 900;
const VIEWPORT_DEBOUNCE_MS = 200;
const VIEWPORT_PROGRAMMATIC_GUARD_MS = 650;
const USER_VIEWPORT_LOCK_KEYS = new Set([
  "+",
  "-",
  "=",
  "_",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);
const REAL_PLANNING_STAGES = new Set([
  "macro_planning",
  "graph_splitting",
  "day_expansion",
  "review",
  "final_output",
]);
const AMAP_LIGHT_STYLE = "amap://styles/normal";
const AMAP_DARK_STYLE = "amap://styles/dark";
const INITIAL_THREAD_ID = "travel-thread-draft";
const INITIAL_RUN_ID = "travel-run-draft";
const LEAFLET_LIGHT_TILE_LAYER = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap contributors",
};
const LEAFLET_DARK_TILE_LAYER = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
};

const getAmapStyle = (isNightMode: boolean) => (isNightMode ? AMAP_DARK_STYLE : AMAP_LIGHT_STYLE);

const getLeafletTileLayer = (isNightMode: boolean) =>
  isNightMode ? LEAFLET_DARK_TILE_LAYER : LEAFLET_LIGHT_TILE_LAYER;

const isDarkColorValue = (value: string) => {
  const color = value.trim();
  if (!color) {
    return false;
  }

  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((item) => `${item}${item}`)
            .join("")
        : hex;
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return red * 0.299 + green * 0.587 + blue * 0.114 < 96;
  }

  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (!rgbMatch) {
    return false;
  }
  const [red, green, blue] = rgbMatch[1]
    .split(/[\s,/]+/)
    .map((item) => Number.parseFloat(item))
    .filter((item) => Number.isFinite(item));

  if (red === undefined || green === undefined || blue === undefined) {
    return false;
  }

  return red * 0.299 + green * 0.587 + blue * 0.114 < 96;
};

const readIsMapNightMode = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (resolveProfileThemeId(window.localStorage.getItem(PROFILE_THEME_STORAGE_KEY)) === "night") {
    return true;
  }
  if (document.documentElement.classList.contains("dark")) {
    return true;
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  return isDarkColorValue(
    rootStyles.getPropertyValue("--background") || rootStyles.backgroundColor,
  );
};

const useMapNightMode = () => {
  const [isNightMode, setIsNightMode] = useState(() => readIsMapNightMode());

  useEffect(() => {
    const syncNightMode = () => setIsNightMode(readIsMapNightMode());
    syncNightMode();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_THEME_STORAGE_KEY) {
        syncNightMode();
      }
    };
    const rootObserver = new MutationObserver(syncNightMode);

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PROFILE_THEME_EVENT_NAME, syncNightMode);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PROFILE_THEME_EVENT_NAME, syncNightMode);
      rootObserver.disconnect();
    };
  }, []);

  return isNightMode;
};

const shouldAutoRevealMap = (event: PublicPlanningEvent) => {
  if (event.type === "planning_stage_changed") {
    return Boolean(
      event.stage && REAL_PLANNING_STAGES.has(event.stage) && event.status !== "waiting",
    );
  }

  return (
    event.type === "map_scope_changed" ||
    event.type === "map_batch" ||
    event.type.startsWith("route_")
  );
};

const isMapPlanningEvent = (event: PublicPlanningEvent) =>
  event.type === "map_scope_changed" ||
  event.type.startsWith("map_point_") ||
  event.type.startsWith("map_annotation_") ||
  event.type.startsWith("route_") ||
  event.type === "map_batch";

const hasMapContent = (state: MapPlanningState) =>
  Object.keys(state.points).length > 0 ||
  Object.keys(state.routes).length > 0 ||
  Object.keys(state.annotations).length > 0 ||
  Boolean(state.viewport);

const mergeHistoryRuns = (current: TravelRunSummary[], incoming: TravelRunSummary[]) => {
  const map = new Map<string, TravelRunSummary>();
  [...current, ...incoming].forEach((run) => {
    if (run.runId) {
      map.set(run.runId, run);
    }
  });
  return Array.from(map.values()).sort((left, right) =>
    (right.updatedAt || "").localeCompare(left.updatedAt || ""),
  );
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncDesktop = () => setIsDesktop(mediaQuery.matches);

    syncDesktop();
    mediaQuery.addEventListener("change", syncDesktop);
    return () => mediaQuery.removeEventListener("change", syncDesktop);
  }, []);

  return isDesktop;
};

interface TimelineFocusTarget {
  nodeId?: string;
  routeId?: string;
  nonce: number;
}

export const TravelAgentWorkspace = () => {
  const [mode, setMode] = useState<TravelAgentMode>("chat");
  const [messages, setMessages] = useState<TravelChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [mapState, setMapState] = useState<MapPlanningState>(() => createInitialMapState());
  const isMapNightMode = useMapNightMode();
  const [latestEvent, setLatestEvent] = useState<PublicPlanningEvent | undefined>();
  const [timelineEvents, setTimelineEvents] = useState<PublicPlanningEvent[]>([]);
  const [timelineNowMs, setTimelineNowMs] = useState(0);
  const [focusedTimelineTarget, setFocusedTimelineTarget] = useState<TimelineFocusTarget>();
  const [isMapCanvasReady, setIsMapCanvasReady] = useState(false);
  const [isViewportLocked, setIsViewportLocked] = useState(false);
  const [viewportResetKey, setViewportResetKey] = useState(0);
  const [threadId, setThreadId] = useState(INITIAL_THREAD_ID);
  const [runId, setRunId] = useState(INITIAL_RUN_ID);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRuns, setHistoryRuns] = useState<TravelRunSummary[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | undefined>();
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null);
  const [isHistoryDetailLoading, setIsHistoryDetailLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedHistoryRef = useRef(false);
  const hasMapCanvasEverReadyRef = useRef(false);

  const latestStatus = useMemo(() => {
    return getEventStatusLabel(latestEvent);
  }, [latestEvent]);
  const thinkingTimeline = useMemo(
    () => buildThinkingTimelineFromEvents(timelineEvents, timelineNowMs),
    [timelineEvents, timelineNowMs],
  );

  useEffect(() => {
    setThreadId((current) => (current === INITIAL_THREAD_ID ? createId("travel-thread") : current));
    setRunId((current) => (current === INITIAL_RUN_ID ? createId("travel-run") : current));
  }, []);

  useEffect(() => {
    if (!isStreaming || thinkingTimeline.steps.length === 0) {
      return;
    }
    const timer = window.setInterval(() => setTimelineNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, thinkingTimeline.steps.length]);

  const clearRevealTimeout = useCallback(() => {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearRevealTimeout, [clearRevealTimeout]);

  const openMapNow = useCallback(() => {
    clearRevealTimeout();
    setMode("map");
  }, [clearRevealTimeout]);

  const openChatOverlay = useCallback(() => {
    clearRevealTimeout();
    setMode("chat_overlay");
  }, [clearRevealTimeout]);

  const handleMapReadyChange = useCallback((ready: boolean) => {
    if (ready) {
      hasMapCanvasEverReadyRef.current = true;
      setIsMapCanvasReady(true);
      return;
    }
    if (!hasMapCanvasEverReadyRef.current) {
      setIsMapCanvasReady(false);
    }
  }, []);

  const resetViewportLock = useCallback(() => {
    setIsViewportLocked(false);
    setViewportResetKey((current) => current + 1);
  }, []);

  const handleResetRouteView = useCallback(() => {
    setIsViewportLocked(true);
    setViewportResetKey((current) => current + 1);
  }, []);

  const revealMapIfNeeded = useCallback(
    (event: PublicPlanningEvent) => {
      if (!shouldAutoRevealMap(event) || mode !== "chat") {
        return;
      }

      clearRevealTimeout();
      if (prefersReducedMotion()) {
        setMode("map");
        return;
      }

      setMode("map_revealing");
      revealTimeoutRef.current = setTimeout(() => {
        revealTimeoutRef.current = null;
        setMode((current) => (current === "map_revealing" ? "map" : current));
      }, MAP_REVEAL_DURATION_MS);
    },
    [clearRevealTimeout, mode],
  );

  const appendAssistantDelta = useCallback((delta: string) => {
    if (!delta) {
      return;
    }
    const messageId = assistantMessageIdRef.current ?? createId("assistant");
    assistantMessageIdRef.current = messageId;

    setMessages((current) => {
      const exists = current.some((item) => item.id === messageId);
      if (!exists) {
        return [
          ...current,
          { id: messageId, role: "assistant", content: delta, status: "streaming" },
        ];
      }
      return current.map((item) =>
        item.id === messageId ? { ...item, content: `${item.content}${delta}` } : item,
      );
    });
  }, []);

  const handlePlanningEvent = useCallback(
    (event: PublicPlanningEvent) => {
      const receivedAtMs = Date.now();
      setLatestEvent(event);
      setTimelineEvents((current) => appendThinkingEvent(current, event, receivedAtMs));
      setTimelineNowMs(receivedAtMs);
      if (event.type === "chat_message_delta") {
        appendAssistantDelta(event.message ?? "");
      } else if (event.type === "planning_completed") {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageIdRef.current ? { ...item, status: "done" } : item,
          ),
        );
      } else if (event.type === "planning_error") {
        setMessages((current) => [
          ...current,
          {
            id: createId("assistant-error"),
            role: "assistant",
            content: event.message || "规划过程中出现错误，请稍后重试。",
            status: "error",
          },
        ]);
      }

      if (isMapPlanningEvent(event)) {
        setMapState((current) => applyPlanningEvent(current, event));
      }
      revealMapIfNeeded(event);
    },
    [appendAssistantDelta, revealMapIfNeeded],
  );

  const loadHistory = useCallback(async (cursor?: string) => {
    if (cursor) {
      setIsHistoryLoadingMore(true);
    } else {
      setIsHistoryLoading(true);
    }
    setHistoryError(null);

    try {
      const result = await fetchTravelRunHistory({ limit: 20, cursor });
      setHistoryRuns((current) => (cursor ? mergeHistoryRuns(current, result.runs) : result.runs));
      setHistoryCursor(result.nextCursor);
      hasLoadedHistoryRef.current = true;
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "历史记录暂时不可用。");
    } finally {
      setIsHistoryLoading(false);
      setIsHistoryLoadingMore(false);
    }
  }, []);

  const openHistory = useCallback(() => {
    setHistoryNotice(null);
    setIsHistoryOpen(true);
    if (!hasLoadedHistoryRef.current) {
      void loadHistory();
    }
  }, [loadHistory]);

  const handleNewPlanning = useCallback(() => {
    if (isStreaming) {
      setHistoryNotice("请先停止或等待当前规划完成。");
      setIsHistoryOpen(true);
      return;
    }

    clearRevealTimeout();
    abortRef.current = null;
    assistantMessageIdRef.current = null;
    setThreadId(createId("travel-thread"));
    setRunId(createId("travel-run"));
    setMessages([]);
    setDraft("");
    setMapState(createInitialMapState());
    setLatestEvent(undefined);
    setTimelineEvents([]);
    setTimelineNowMs(Date.now());
    setFocusedTimelineTarget(undefined);
    resetViewportLock();
    setMode("chat");
    setHistoryNotice(null);
    setSelectedHistoryRunId(null);
    setIsHistoryOpen(false);
  }, [clearRevealTimeout, isStreaming, resetViewportLock]);

  const handleSelectHistoryRun = useCallback(
    async (historyRun: TravelRunSummary) => {
      if (isStreaming) {
        setHistoryNotice("请先停止或等待当前规划完成。");
        return;
      }

      setHistoryNotice(null);
      setHistoryError(null);
      setSelectedHistoryRunId(historyRun.runId);
      setIsHistoryDetailLoading(true);

      try {
        const detail = await fetchTravelRunDetail(historyRun.runId);
        const restoredMapState =
          detail.mapSnapshot ?? hydrateMapStateFromEvents(detail.events ?? []);
        clearRevealTimeout();
        assistantMessageIdRef.current = null;
        setThreadId(detail.run.threadId || createId("travel-thread"));
        setRunId(detail.run.runId || historyRun.runId);
        setMessages(
          detail.messages.map((message) => ({
            id: message.id || createId(message.role),
            role: message.role,
            content: message.content,
            status: message.status ?? "done",
          })),
        );
        setDraft("");
        setMapState(restoredMapState);
        setTimelineEvents(detail.events ?? []);
        setTimelineNowMs(Date.now());
        setFocusedTimelineTarget(undefined);
        resetViewportLock();
        setLatestEvent(detail.events[detail.events.length - 1]);
        setHistoryRuns((current) => mergeHistoryRuns(current, [detail.run]));
        setMode(
          hasMapContent(restoredMapState) || detail.events.some(isMapPlanningEvent)
            ? "map"
            : "chat",
        );
        setIsHistoryOpen(false);
      } catch (error) {
        setHistoryError(error instanceof Error ? error.message : "历史详情暂时不可用。");
      } finally {
        setIsHistoryDetailLoading(false);
      }
    },
    [clearRevealTimeout, isStreaming, resetViewportLock],
  );

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || isStreaming) {
      return;
    }

    const nextRunId = createId("travel-run");
    const activeThreadId = threadId === INITIAL_THREAD_ID ? createId("travel-thread") : threadId;
    const controller = new AbortController();
    const outboundMessages = [
      ...messages
        .filter((message) => message.content.trim())
        .map((message) => ({ role: message.role, content: message.content })),
      { role: "user" as const, content },
    ];
    abortRef.current = controller;
    assistantMessageIdRef.current = createId("assistant");

    setThreadId(activeThreadId);
    setRunId(nextRunId);
    setDraft("");
    setIsStreaming(true);
    setLatestEvent(undefined);
    setTimelineEvents([]);
    setTimelineNowMs(Date.now());
    setFocusedTimelineTarget(undefined);
    if (!hasMapContent(mapState)) {
      resetViewportLock();
    }
    setMessages((current) => [
      ...current,
      { id: createId("user"), role: "user", content, status: "done" },
      { id: assistantMessageIdRef.current!, role: "assistant", content: "", status: "streaming" },
    ]);

    try {
      await streamTravelAgent(
        {
          threadId: activeThreadId,
          runId: nextRunId,
          messages: outboundMessages,
        },
        {
          signal: controller.signal,
          onEvent: handlePlanningEvent,
        },
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages((current) => [
          ...current,
          {
            id: createId("assistant-error"),
            role: "assistant",
            content: error instanceof Error ? error.message : "旅行规划服务暂时不可用。",
            status: "error",
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageIdRef.current && item.status === "streaming"
            ? { ...item, status: "done" }
            : item,
        ),
      );
      if (hasLoadedHistoryRef.current) {
        void loadHistory();
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    if (hasLoadedHistoryRef.current) {
      void loadHistory();
    }
  };

  return (
    <div
      className={cn(
        "text-foreground relative overflow-hidden bg-transparent",
        "h-[calc(100dvh-3.5rem)] min-h-[420px] lg:h-screen",
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          mode === "chat" && "pointer-events-none opacity-0",
          mode !== "chat" && "opacity-100",
        )}
      >
        <MapStage
          state={mapState}
          mode={mode}
          isNightMode={isMapNightMode}
          latestStatus={latestStatus}
          latestEvent={latestEvent}
          thinkingTimeline={thinkingTimeline}
          focusedTimelineTarget={focusedTimelineTarget}
          runId={runId}
          isStreaming={isStreaming}
          isMapReady={isMapCanvasReady}
          isViewportLocked={isViewportLocked}
          viewportResetKey={viewportResetKey}
          onMapReadyChange={handleMapReadyChange}
          onViewportLockedChange={setIsViewportLocked}
          onResetRouteView={handleResetRouteView}
          onOpenHistory={openHistory}
          onOpenChat={openChatOverlay}
          onBackToMap={openMapNow}
          onStop={handleStop}
          onToggleDimmed={() =>
            setMapState((current) => ({ ...current, showDimmed: !current.showDimmed }))
          }
          onToggleAnnotationFilter={(filter) =>
            setMapState((current) => ({
              ...current,
              annotationFilters: {
                ...current.annotationFilters,
                [filter]: !current.annotationFilters[filter],
              },
            }))
          }
          onFocusTimelineTarget={(target) =>
            setFocusedTimelineTarget({
              ...target,
              nonce: Date.now(),
            })
          }
        >
          <ChatDrawer
            isOpen={mode === "chat_overlay"}
            messages={messages}
            thinkingTimeline={thinkingTimeline}
            draft={draft}
            isStreaming={isStreaming}
            onDraftChange={setDraft}
            onSend={() => void handleSend()}
            onClose={openMapNow}
          />
        </MapStage>
      </div>

      {mode === "chat" && (
        <div className="absolute inset-0 z-30">
          <ChatStage
            messages={messages}
            draft={draft}
            isStreaming={isStreaming}
            onDraftChange={setDraft}
            onSend={() => void handleSend()}
            onOpenHistory={openHistory}
            onOpenMap={openMapNow}
            onNewPlanning={handleNewPlanning}
            thinkingDurationMs={thinkingTimeline.totalDurationMs}
            thinkingTimeline={thinkingTimeline}
          />
        </div>
      )}

      {mode === "map_revealing" && (
        <div className="travel-chat-release pointer-events-none absolute inset-0 z-30">
          <ChatStage
            messages={messages}
            draft={draft}
            isStreaming={isStreaming}
            onDraftChange={setDraft}
            onSend={() => void handleSend()}
            onOpenHistory={openHistory}
            onOpenMap={openMapNow}
            onNewPlanning={handleNewPlanning}
            thinkingDurationMs={thinkingTimeline.totalDurationMs}
            thinkingTimeline={thinkingTimeline}
          />
        </div>
      )}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        runs={historyRuns}
        activeRunId={runId}
        cursor={historyCursor}
        isStreaming={isStreaming}
        isLoading={isHistoryLoading}
        isLoadingMore={isHistoryLoadingMore}
        isDetailLoading={isHistoryDetailLoading}
        selectedRunId={selectedHistoryRunId}
        error={historyError}
        notice={historyNotice}
        onClose={() => setIsHistoryOpen(false)}
        onRefresh={() => void loadHistory()}
        onLoadMore={() => historyCursor && void loadHistory(historyCursor)}
        onSelect={(historyRun) => void handleSelectHistoryRun(historyRun)}
        onNewPlanning={handleNewPlanning}
      />
    </div>
  );
};

interface ChatStageProps {
  messages: TravelChatMessage[];
  thinkingTimeline: ThinkingTimeline;
  draft: string;
  isStreaming: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onOpenHistory: () => void;
  onOpenMap: () => void;
  onNewPlanning: () => void;
  thinkingDurationMs: number;
}

const ChatStage = ({
  messages,
  thinkingTimeline,
  draft,
  isStreaming,
  onDraftChange,
  onSend,
  onOpenHistory,
  onOpenMap,
  onNewPlanning,
  thinkingDurationMs,
}: ChatStageProps) => (
  <section className="mx-auto flex h-full w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-6">
    <header className="border-border/70 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-foreground text-xl font-semibold sm:text-2xl">旅行规划 Agent</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          需求确认后会自动进入地图规划。
          {thinkingDurationMs > 0 ? ` 已思考 ${formatDuration(thinkingDurationMs)}。` : ""}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onOpenHistory}
          className="w-full sm:w-auto"
        >
          <HistoryIcon className="size-4" />
          历史
        </Button>
        <Button type="button" variant="outline" onClick={onOpenMap} className="w-full sm:w-auto">
          <MapIcon className="size-4" />
          地图
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onNewPlanning}
          disabled={isStreaming}
          className="w-full sm:w-auto"
        >
          <PlusIcon className="size-4" />
          新建
        </Button>
      </div>
    </header>

    <MessageList
      messages={messages}
      thinkingTimeline={thinkingTimeline}
      isStreaming={isStreaming}
      className="flex-1"
    />

    <PromptComposer
      value={draft}
      isStreaming={isStreaming}
      onChange={onDraftChange}
      onSend={onSend}
    />
  </section>
);

interface MapStageProps {
  children: ReactNode;
  state: MapPlanningState;
  mode: TravelAgentMode;
  isNightMode: boolean;
  latestStatus: string;
  latestEvent?: PublicPlanningEvent;
  thinkingTimeline: ThinkingTimeline;
  focusedTimelineTarget?: TimelineFocusTarget;
  runId: string;
  isStreaming: boolean;
  isMapReady: boolean;
  isViewportLocked: boolean;
  viewportResetKey: number;
  onMapReadyChange: (ready: boolean) => void;
  onViewportLockedChange: (locked: boolean) => void;
  onResetRouteView: () => void;
  onOpenHistory: () => void;
  onOpenChat: () => void;
  onBackToMap: () => void;
  onStop: () => void;
  onToggleDimmed: () => void;
  onToggleAnnotationFilter: (filter: keyof MapAnnotationFilters) => void;
  onFocusTimelineTarget: (target: Omit<TimelineFocusTarget, "nonce">) => void;
}

const MapStage = ({
  children,
  state,
  mode,
  isNightMode,
  latestStatus,
  latestEvent,
  thinkingTimeline,
  focusedTimelineTarget,
  runId,
  isStreaming,
  isMapReady,
  isViewportLocked,
  viewportResetKey,
  onMapReadyChange,
  onViewportLockedChange,
  onResetRouteView,
  onOpenHistory,
  onOpenChat,
  onBackToMap,
  onStop,
  onToggleDimmed,
  onToggleAnnotationFilter,
  onFocusTimelineTarget,
}: MapStageProps) => {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const visiblePoints = useMemo(
    () =>
      Object.values(state.points).filter((item) => state.showDimmed || item.status !== "dimmed"),
    [state.points, state.showDimmed],
  );
  const visibleRoutes = useMemo(
    () =>
      Object.values(state.routes).filter((item) => state.showDimmed || item.status !== "dimmed"),
    [state.routes, state.showDimmed],
  );
  const visibleAnnotations = useMemo(() => getVisibleAnnotations(state), [state]);
  const annotationsByNode = useMemo(() => {
    const grouped: Record<string, MapAnnotationState[]> = {};
    visibleAnnotations.forEach((item) => {
      const nodeId = item.annotation.anchor.nodeId;
      if (!nodeId || item.annotation.anchor.type !== "point") {
        return;
      }
      grouped[nodeId] = [...(grouped[nodeId] ?? []), item];
    });
    return grouped;
  }, [visibleAnnotations]);
  const pointsById = useMemo(() => {
    const grouped: Record<string, MapPointState> = {};
    visiblePoints.forEach((item) => {
      grouped[item.id] = item;
    });
    return grouped;
  }, [visiblePoints]);

  return (
    <section className="relative isolate h-full min-h-[420px] overflow-hidden">
      <div className="absolute inset-0 z-0">
        <TravelMapCanvas
          points={visiblePoints}
          routes={visibleRoutes}
          pointsById={pointsById}
          annotationsByNode={annotationsByNode}
          focusTarget={focusedTimelineTarget}
          isNightMode={isNightMode}
          isViewportLocked={isViewportLocked}
          viewportResetKey={viewportResetKey}
          onReadyChange={onMapReadyChange}
          onViewportLockedChange={onViewportLockedChange}
        />
      </div>

      {!isMapReady && mode !== "chat" && (
        <div className="bg-background/45 pointer-events-none absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="app-surface-elevated flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold">
            <Loader2Icon className="text-primary size-4 animate-spin" />
            正在准备地图
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 sm:top-4 sm:left-4 sm:max-w-[calc(100%-2rem)] sm:gap-2">
        <div className="app-surface max-w-[15rem] rounded-lg px-3 py-2 sm:max-w-none">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <RouteIcon className="text-primary size-4" />
            {latestStatus}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {state.activeLevel} · {runId.slice(0, 18)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onToggleDimmed}>
          {state.showDimmed ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
          暗置点
        </Button>
      </div>

      <div className="absolute top-3 right-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1.5 sm:top-4 sm:right-4 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="历史"
          title="历史"
          onClick={onOpenHistory}
        >
          <HistoryIcon className="size-4" />
          <span className="hidden min-[420px]:inline">历史</span>
        </Button>
        {mode === "chat_overlay" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="回到地图"
            title="回到地图"
            onClick={onBackToMap}
          >
            <MapIcon className="size-4" />
            <span className="hidden min-[420px]:inline">回到地图</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="对话"
            title="对话"
            onClick={onOpenChat}
          >
            <MessageCircleIcon className="size-4" />
            <span className="hidden min-[420px]:inline">对话</span>
          </Button>
        )}
        {isStreaming && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            aria-label="停止"
            title="停止"
            onClick={onStop}
          >
            <SquareIcon className="size-4" />
            <span className="hidden min-[420px]:inline">停止</span>
          </Button>
        )}
      </div>

      {mode !== "chat_overlay" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="打开对话"
          title="对话"
          className="shadow-primary/10 absolute top-24 right-4 z-30 hidden shadow-lg md:inline-flex"
          onClick={onOpenChat}
        >
          <MessageCircleIcon className="size-4" />
          对话
        </Button>
      )}

      {(visiblePoints.length > 0 || visibleRoutes.length > 0) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="app-surface-elevated absolute right-3 bottom-[8.5rem] z-30 shadow-lg md:right-4 md:bottom-4"
          onClick={onResetRouteView}
          title={isViewportLocked ? "视角已锁定，点击回到路线范围" : "回到路线范围"}
        >
          <RefreshCwIcon className="size-4" />
          回到路线
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="app-surface-elevated absolute bottom-[8.5rem] left-3 z-30 shadow-lg md:hidden"
        onClick={() => setIsEvidenceOpen(true)}
      >
        <LightbulbIcon className="size-4" />
        规划链路
      </Button>

      <MapEvidencePanel
        state={state}
        timeline={thinkingTimeline}
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        onToggleFilter={onToggleAnnotationFilter}
        onFocusTimelineTarget={onFocusTimelineTarget}
      />
      <MapLegend routes={visibleRoutes} points={visiblePoints} />
      <MapEventDock state={state} latestEvent={latestEvent} />
      {children}
    </section>
  );
};

const MessageList = ({
  messages,
  thinkingTimeline,
  isStreaming,
  className,
}: {
  messages: TravelChatMessage[];
  thinkingTimeline: ThinkingTimeline;
  isStreaming: boolean;
  className?: string;
}) => {
  const latestAssistantMessageId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.id,
    [messages],
  );

  return (
    <div className={cn("space-y-4 overflow-y-auto py-6", className)}>
      {messages.map((message) => {
        const isUser = message.role === "user";
        const shouldShowThinking =
          !isUser &&
          message.id === latestAssistantMessageId &&
          message.status !== "error" &&
          thinkingTimeline.steps.length > 0;

        return (
          <div key={message.id} className={cn("flex gap-3", isUser && "justify-end")}>
            {!isUser && (
              <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <BotIcon className="size-4" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[88%] rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[78%]",
                isUser
                  ? "border-primary bg-primary text-primary-foreground"
                  : "app-surface text-foreground",
                message.status === "error" &&
                  "border-destructive/50 bg-destructive/10 text-destructive",
              )}
            >
              {shouldShowThinking && (
                <InlineThinkingTimeline timeline={thinkingTimeline} isStreaming={isStreaming} />
              )}
              <MarkdownArticle
                value={message.content || ""}
                emptyText={message.status === "streaming" ? "正在组织回复..." : ""}
                className={cn(
                  "travel-chat-markdown",
                  isUser && "travel-chat-markdown-user",
                  message.status === "error" && "travel-chat-markdown-error",
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const InlineThinkingTimeline = ({
  timeline,
  isStreaming,
}: {
  timeline: ThinkingTimeline;
  isStreaming: boolean;
}) => {
  const activeStep = timeline.steps.findLast(
    (step) => step.status !== "completed" && step.status !== "failed",
  );

  if (timeline.steps.length === 0) {
    return null;
  }

  return (
    <div className="border-border/70 bg-background/45 mb-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
            <LightbulbIcon className="text-primary size-3.5" />
            规划链路
          </div>
          <p className="text-muted-foreground mt-1 line-clamp-1 text-[11px]">
            {activeStep?.title || "公开思考会按步骤串联展示"}
          </p>
        </div>
        {isStreaming && (
          <span className="bg-primary/10 text-primary shrink-0 rounded px-2 py-1 text-[11px] font-semibold">
            进行中
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <InlineTimelineStat label="总思考" value={formatDuration(timeline.totalDurationMs)} />
        <InlineTimelineStat
          label="当前步骤"
          value={formatDuration(timeline.currentStepDurationMs)}
        />
        <InlineTimelineStat label="已完成" value={`${timeline.completedStepCount} 步`} />
      </div>

      <div className="mt-3 space-y-2">
        {timeline.steps.map((step) => (
          <InlineTimelineStepCard key={step.id} step={step} isActive={step.id === activeStep?.id} />
        ))}
      </div>
    </div>
  );
};

const InlineTimelineStat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-muted/55 rounded-md px-2.5 py-2">
    <p className="text-muted-foreground text-[10px] font-semibold">{label}</p>
    <p className="text-foreground mt-0.5 text-xs font-semibold tabular-nums">{value}</p>
  </div>
);

const InlineTimelineStepCard = ({
  step,
  isActive,
}: {
  step: ThinkingTimelineStep;
  isActive: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFoldedEntries = step.entries.length > 3;
  const entriesToRender = hasFoldedEntries && !isExpanded ? step.entries.slice(0, 3) : step.entries;
  const toggleEntries = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };

  return (
    <article
      className={cn(
        "relative rounded-lg border px-3 py-2.5",
        isActive ? "border-primary/45 bg-primary/10" : "border-border/70 bg-background/55",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
            <span className="bg-muted rounded px-1.5 py-0.5">Step {step.index}</span>
            <span className="bg-muted rounded px-1.5 py-0.5">
              {getTimelineStatusLabel(step.status)}
            </span>
            <span className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums">
              <ClockIcon className="size-3" />
              {formatDuration(step.durationMs)}
            </span>
            {step.usage.totalTokens > 0 && (
              <span className="bg-muted rounded px-1.5 py-0.5 tabular-nums">
                Token {formatTokenCount(step.usage.totalTokens)}
              </span>
            )}
            {step.usage.models.length > 0 && (
              <span className="bg-muted rounded px-1.5 py-0.5">
                {formatModelSummary(step.usage.models)}
              </span>
            )}
          </div>
          <h3 className="text-foreground mt-1.5 line-clamp-2 text-xs leading-5 font-semibold">
            {step.title}
          </h3>
        </div>
        {isActive && (
          <span className="bg-primary text-primary-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
            进行中
          </span>
        )}
      </div>

      {step.summary && (
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-[11px] leading-4">
          {step.summary}
        </p>
      )}

      {entriesToRender.length > 0 && (
        <div className="border-border/70 mt-2 space-y-1.5 border-t pt-2">
          {entriesToRender.map((entry) => (
            <InlineTimelineEntryRow key={entry.id} entry={entry} />
          ))}
          {hasFoldedEntries && (
            <button
              type="button"
              className="text-primary hover:bg-primary/10 w-full rounded-md px-2 py-1 text-left text-[11px] font-semibold transition"
              onClick={toggleEntries}
            >
              {isExpanded ? "收起记录" : `展开全部 ${step.entries.length} 条记录`}
            </button>
          )}
        </div>
      )}
    </article>
  );
};

const InlineTimelineEntryRow = ({ entry }: { entry: ThinkingTimelineEntry }) => (
  <div className="bg-background/70 rounded-md px-2 py-1.5">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-foreground line-clamp-1 text-[11px] font-semibold">{entry.title}</p>
        {entry.summary && (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px] leading-4">
            {entry.summary}
          </p>
        )}
      </div>
      <span className="bg-muted text-muted-foreground flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
        {getTimelineKindIcon(entry)}
        {getTimelineKindLabel(entry)}
      </span>
    </div>
    {entry.recordedFacts && entry.recordedFacts.length > 0 && (
      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[10px]">
        {entry.recordedFacts.join(" · ")}
      </p>
    )}
    {entry.usage && (
      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[10px] tabular-nums">
        {formatUsageLine(entry.usage)}
      </p>
    )}
    {entry.annotation?.url && (
      <a
        href={entry.annotation.url}
        target="_blank"
        rel="noreferrer"
        className="text-primary mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold"
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLinkIcon className="size-3" />
        查看素材
      </a>
    )}
  </div>
);

interface PromptComposerProps {
  value: string;
  isStreaming: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}

const PromptComposer = ({ value, isStreaming, onChange, onSend }: PromptComposerProps) => (
  <div className="border-border/70 border-t pt-4">
    <div className="app-surface flex gap-3 rounded-lg p-2">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="text-foreground placeholder:text-muted-foreground min-h-20 flex-1 resize-none rounded-md bg-transparent px-3 py-2 text-sm outline-none"
        placeholder="输入旅行需求"
      />
      <Button
        type="button"
        size="icon-lg"
        onClick={onSend}
        disabled={isStreaming || !value.trim()}
        aria-label="发送"
      >
        <SendIcon className="size-5" />
      </Button>
    </div>
  </div>
);

interface ChatDrawerProps {
  isOpen: boolean;
  messages: TravelChatMessage[];
  thinkingTimeline: ThinkingTimeline;
  draft: string;
  isStreaming: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}

const ChatDrawer = ({
  isOpen,
  messages,
  thinkingTimeline,
  draft,
  isStreaming,
  onDraftChange,
  onSend,
  onClose,
}: ChatDrawerProps) => {
  const isDesktop = useIsDesktop();
  const drawerStyle = isDesktop
    ? { top: 0, right: isOpen ? 0 : -440, bottom: 0 }
    : { top: isOpen ? "22%" : "100%", bottom: isOpen ? 0 : "auto" };

  return (
    <aside
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
      style={drawerStyle}
      className={cn(
        "app-surface-elevated fixed z-[60] shadow-2xl md:absolute",
        "right-0 left-0 max-h-[78%] rounded-t-lg md:top-0 md:bottom-auto md:left-auto md:h-full md:max-h-none md:w-[440px] md:rounded-t-none md:rounded-l-lg",
        !isOpen && "pointer-events-none",
      )}
    >
      <div className="flex h-full flex-col p-4">
        <div className="border-border/70 flex items-center justify-between border-b pb-3">
          <div className="text-foreground flex items-center gap-2 font-semibold">
            <MessageCircleIcon className="text-primary size-4" />
            对话
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭">
            <XIcon className="size-4" />
          </Button>
        </div>
        <MessageList
          messages={messages}
          thinkingTimeline={thinkingTimeline}
          isStreaming={isStreaming}
          className="min-h-0 flex-1"
        />
        <PromptComposer
          value={draft}
          isStreaming={isStreaming}
          onChange={onDraftChange}
          onSend={onSend}
        />
      </div>
    </aside>
  );
};

const getHistoryStageLabel = (stage: string) => {
  const labels: Record<string, string> = {
    requirement_intake: "需求确认",
    awaiting_user_info: "等待补充",
    macro_planning: "宏观规划",
    graph_splitting: "拆分规划",
    day_expansion: "日级探索",
    review: "权衡复核",
    final_output: "已出结果",
  };
  return labels[stage] ?? (stage || "需求确认");
};

const getHistoryStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    running: "进行中",
    waiting: "等待中",
    active: "进行中",
    completed: "已完成",
    failed: "失败",
  };
  return labels[status] ?? (status || "进行中");
};

const formatHistoryTime = (value: string) => {
  if (!value) {
    return "刚刚";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

interface HistoryDrawerProps {
  isOpen: boolean;
  runs: TravelRunSummary[];
  activeRunId: string;
  cursor?: string;
  isStreaming: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isDetailLoading: boolean;
  selectedRunId: string | null;
  error: string | null;
  notice: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onSelect: (run: TravelRunSummary) => void;
  onNewPlanning: () => void;
}

const HistoryDrawer = ({
  isOpen,
  runs,
  activeRunId,
  cursor,
  isStreaming,
  isLoading,
  isLoadingMore,
  isDetailLoading,
  selectedRunId,
  error,
  notice,
  onClose,
  onRefresh,
  onLoadMore,
  onSelect,
  onNewPlanning,
}: HistoryDrawerProps) => {
  const isDesktop = useIsDesktop();
  const drawerStyle = isDesktop
    ? { top: 0, bottom: 0, left: isOpen ? 0 : -400 }
    : { top: isOpen ? "18%" : "100%", bottom: isOpen ? 0 : "auto" };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="关闭历史"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:absolute md:bg-transparent"
          onClick={onClose}
        />
      )}
      <aside
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
        style={drawerStyle}
        className={cn(
          "app-surface-elevated fixed z-50 shadow-2xl md:absolute",
          "right-0 left-0 max-h-[82%] rounded-t-lg md:top-0 md:right-auto md:bottom-auto md:h-full md:max-h-none md:w-[400px] md:rounded-t-none md:rounded-r-lg",
          !isOpen && "pointer-events-none",
        )}
      >
        <div className="flex h-full flex-col p-4">
          <div className="border-border/70 flex items-center justify-between gap-3 border-b pb-3">
            <div className="text-foreground flex min-w-0 items-center gap-2 font-semibold">
              <HistoryIcon className="text-primary size-4" />
              历史
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="刷新历史"
              >
                <RefreshCwIcon className={cn("size-4", isLoading && "animate-spin")} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="关闭"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="border-border/70 flex items-center justify-between gap-3 border-b py-3">
            <div className="min-w-0">
              <p className="text-foreground text-sm font-semibold">规划记录</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                选择一条记录恢复对话和地图结果。
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewPlanning}
              disabled={isStreaming}
            >
              <PlusIcon className="size-4" />
              新建
            </Button>
          </div>

          {notice && (
            <div className="border-border bg-muted/70 text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-xs">
              {notice}
            </div>
          )}
          {error && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive mt-3 rounded-lg border px-3 py-2 text-xs">
              {error}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            {isLoading && runs.length === 0 ? (
              <div className="text-muted-foreground flex h-40 items-center justify-center gap-2 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                正在加载历史
              </div>
            ) : runs.length === 0 ? (
              <div className="border-border/70 bg-muted/40 text-muted-foreground rounded-lg border px-4 py-6 text-center text-sm">
                还没有旅行规划记录。
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => {
                  const isActive = run.runId === activeRunId;
                  const isRestoring = isDetailLoading && selectedRunId === run.runId;
                  return (
                    <button
                      key={run.runId}
                      type="button"
                      className={cn(
                        "app-surface-soft hover:border-primary/40 hover:bg-accent/70 block w-full rounded-lg p-3 text-left transition",
                        isActive && "border-primary/60 bg-primary/5",
                      )}
                      onClick={() => onSelect(run)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-foreground line-clamp-1 text-sm font-semibold">
                            {run.title || "旅行规划"}
                          </p>
                          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span>{getHistoryStageLabel(run.stage)}</span>
                            <span>{getHistoryStatusLabel(run.status)}</span>
                            {isActive && <span className="text-primary font-medium">当前</span>}
                          </div>
                        </div>
                        {isRestoring ? (
                          <Loader2Icon className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
                        ) : (
                          <ClockIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        )}
                      </div>
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-5">
                        {run.finalSummary || run.lastMessage || "暂无摘要"}
                      </p>
                      <p className="text-muted-foreground/80 mt-2 text-xs">
                        {formatHistoryTime(run.updatedAt || run.createdAt)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {cursor && runs.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="w-full"
            >
              {isLoadingMore && <Loader2Icon className="size-4 animate-spin" />}
              更多
            </Button>
          )}
        </div>
      </aside>
    </>
  );
};

const isRejectedAnnotation = (item: MapAnnotationState) =>
  item.status === "rejected" ||
  item.status === "dimmed" ||
  item.annotation.status === "rejected" ||
  item.annotation.status === "dimmed";

const isVisibleAnnotation = (item: MapAnnotationState, state: MapPlanningState) => {
  if (!state.showDimmed && item.status === "dimmed") {
    return false;
  }
  if (isRejectedAnnotation(item) && !state.annotationFilters.rejected) {
    return false;
  }
  if (
    (item.annotation.source === "zhihu" || item.annotation.kind === "zhihu_source") &&
    !state.annotationFilters.zhihu
  ) {
    return false;
  }
  if (item.annotation.kind === "thought" && !state.annotationFilters.thought) {
    return false;
  }
  if (item.annotation.kind === "decision" && !state.annotationFilters.decision) {
    return false;
  }
  if (
    (item.annotation.source === "review" || item.annotation.kind === "review") &&
    !state.annotationFilters.review
  ) {
    return false;
  }
  return true;
};

const getVisibleAnnotations = (state: MapPlanningState) =>
  Object.values(state.annotations)
    .filter((item) => isVisibleAnnotation(item, state))
    .sort((left, right) => {
      const statusRank = (item: MapAnnotationState) => {
        if (item.status === "selected") return 0;
        if (item.status === "active") return 1;
        if (item.status === "review") return 2;
        if (item.status === "raw") return 3;
        return 4;
      };
      return statusRank(left) - statusRank(right);
    });

const formatDuration = (durationMs: number) => {
  const ms = Math.max(0, Math.round(durationMs));
  if (ms === 0) {
    return "0秒";
  }
  if (ms < 1000) {
    return "<1秒";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) {
    return `${hours}时${String(minutes).padStart(2, "0")}分`;
  }
  if (totalMinutes > 0) {
    return `${totalMinutes}分${String(seconds).padStart(2, "0")}秒`;
  }
  return `${seconds}秒`;
};

const formatTokenCount = (value: number) => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(value);
};

const formatModelSummary = (models: string[]) => {
  if (models.length === 0) {
    return "模型 -";
  }
  if (models.length === 1) {
    return models[0];
  }
  return `${models[0]} +${models.length - 1}`;
};

const formatUsageLine = (usage: ThinkingTimelineEntry["usage"]) => {
  if (!usage) {
    return "";
  }
  const parts = [
    usage.agentLabel,
    usage.model,
    `Token ${formatTokenCount(usage.totalTokens || 0)}`,
    `输入 ${formatTokenCount(usage.promptTokens || 0)}`,
    `输出 ${formatTokenCount(usage.completionTokens || 0)}`,
  ].filter(Boolean);
  return parts.join(" · ");
};

const getTimelineStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    active: "进行中",
    completed: "已完成",
    failed: "失败",
    waiting: "等待中",
    selected: "已选",
    review: "复核",
    raw: "候选",
    rejected: "已过滤",
    dimmed: "暗置",
  };
  return labels[status] ?? status;
};

const getTimelineKindLabel = (entry: ThinkingTimelineEntry) => {
  if (entry.source === "zhihu" || entry.kind === "zhihu_source") {
    return "知乎";
  }
  if (entry.source === "review" || entry.kind === "review") {
    return "审核";
  }
  if (entry.kind === "decision") {
    return "权衡";
  }
  if (entry.kind === "model_usage" || entry.usage) {
    return "模型";
  }
  if (entry.kind === "error") {
    return "错误";
  }
  if (entry.type.startsWith("map_point_")) {
    return "点位";
  }
  if (entry.type.startsWith("route_")) {
    return "路线";
  }
  return "思考";
};

const getTimelineKindIcon = (entry: ThinkingTimelineEntry) => {
  const label = getTimelineKindLabel(entry);
  if (label === "知乎") {
    return <SearchIcon className="size-3" />;
  }
  if (label === "权衡" || label === "路线") {
    return <ScaleIcon className="size-3" />;
  }
  if (label === "审核") {
    return <ShieldCheckIcon className="size-3" />;
  }
  if (label === "模型") {
    return <BotIcon className="size-3" />;
  }
  return <LightbulbIcon className="size-3" />;
};

const isRejectedTimelineEntry = (entry: ThinkingTimelineEntry) =>
  entry.status === "rejected" ||
  entry.status === "dimmed" ||
  entry.status === "raw" ||
  entry.annotation?.status === "rejected" ||
  entry.annotation?.status === "dimmed" ||
  entry.annotation?.status === "raw";

const isVisibleTimelineEntry = (entry: ThinkingTimelineEntry, filters: MapAnnotationFilters) => {
  if (isRejectedTimelineEntry(entry) && !filters.rejected) {
    return false;
  }
  if ((entry.source === "zhihu" || entry.kind === "zhihu_source") && !filters.zhihu) {
    return false;
  }
  if ((entry.source === "review" || entry.kind === "review") && !filters.review) {
    return false;
  }
  if (entry.kind === "decision" && !filters.decision) {
    return false;
  }
  if (entry.kind === "thought" && !filters.thought) {
    return false;
  }
  return true;
};

const MapEvidencePanel = ({
  state,
  timeline,
  isOpen,
  onClose,
  onToggleFilter,
  onFocusTimelineTarget,
}: {
  state: MapPlanningState;
  timeline: ThinkingTimeline;
  isOpen: boolean;
  onClose: () => void;
  onToggleFilter: (filter: keyof MapAnnotationFilters) => void;
  onFocusTimelineTarget: (target: Omit<TimelineFocusTarget, "nonce">) => void;
}) => {
  const visibleStepCount = timeline.steps.length;
  const activeStep = timeline.steps.findLast(
    (step) => step.status !== "completed" && step.status !== "failed",
  );

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="关闭规划链路"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "pointer-events-auto fixed right-0 bottom-0 left-0 z-50 h-[78%] max-h-[78%] transition-transform duration-300 md:absolute md:top-28 md:right-auto md:bottom-28 md:left-4 md:z-20 md:h-auto md:max-h-none md:w-[min(420px,calc(100%-2rem))] md:translate-y-0",
          isOpen ? "translate-y-0" : "pointer-events-none translate-y-full md:pointer-events-auto",
        )}
      >
        <div className="app-surface-elevated flex h-full min-h-0 flex-col rounded-t-lg shadow-lg md:rounded-lg">
          <div className="border-border/70 flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <LightbulbIcon className="text-primary size-4" />
                规划链路
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {activeStep?.title || "步骤会按规划过程串联展示"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={onClose}
              aria-label="关闭规划链路"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <div className="border-border/70 grid grid-cols-3 gap-2 border-b px-4 py-3">
            <TimelineStat label="总思考" value={formatDuration(timeline.totalDurationMs)} />
            <TimelineStat label="当前步骤" value={formatDuration(timeline.currentStepDurationMs)} />
            <TimelineStat label="已完成" value={`${timeline.completedStepCount} 步`} />
          </div>

          <div className="border-border/70 flex flex-wrap gap-2 border-b px-4 py-3">
            <AnnotationFilterButton
              active={state.annotationFilters.zhihu}
              label="知乎"
              onClick={() => onToggleFilter("zhihu")}
            />
            <AnnotationFilterButton
              active={state.annotationFilters.thought}
              label="思考"
              onClick={() => onToggleFilter("thought")}
            />
            <AnnotationFilterButton
              active={state.annotationFilters.decision}
              label="权衡"
              onClick={() => onToggleFilter("decision")}
            />
            <AnnotationFilterButton
              active={state.annotationFilters.review}
              label="审核"
              onClick={() => onToggleFilter("review")}
            />
            <AnnotationFilterButton
              active={state.annotationFilters.rejected}
              label="已过滤"
              onClick={() => onToggleFilter("rejected")}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {visibleStepCount === 0 ? (
              <div className="app-empty-state rounded-lg px-4 py-6 text-center text-xs">
                规划开始后，公开思考、知乎素材、路线权衡和审核会按步骤出现在这里。
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.steps.map((step) => (
                  <TimelineStepCard
                    key={step.id}
                    step={step}
                    filters={state.annotationFilters}
                    isActive={step.id === activeStep?.id}
                    onFocusTimelineTarget={onFocusTimelineTarget}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

const TimelineStat = ({ label, value }: { label: string; value: string }) => (
  <div className="app-surface-soft rounded-lg px-3 py-2">
    <p className="text-muted-foreground text-[11px] font-semibold">{label}</p>
    <p className="text-foreground mt-1 text-sm font-semibold tabular-nums">{value}</p>
  </div>
);

const AnnotationFilterButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={cn(
      "rounded-md border px-2.5 py-1 text-xs font-medium transition",
      active ? "border-primary/50 bg-primary/10 text-primary" : "app-pill text-muted-foreground",
    )}
    onClick={onClick}
  >
    {label}
  </button>
);

const TimelineStepCard = ({
  step,
  filters,
  isActive,
  onFocusTimelineTarget,
}: {
  step: ThinkingTimelineStep;
  filters: MapAnnotationFilters;
  isActive: boolean;
  onFocusTimelineTarget: (target: Omit<TimelineFocusTarget, "nonce">) => void;
}) => {
  const visibleEntries = step.entries.filter((entry) => isVisibleTimelineEntry(entry, filters));
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFoldedEntries = visibleEntries.length > 4;
  const entriesToRender =
    hasFoldedEntries && !isExpanded ? visibleEntries.slice(0, 4) : visibleEntries;
  const canFocus = Boolean(step.nodeId || step.routeId);
  const handleFocus = () => {
    if (canFocus) {
      onFocusTimelineTarget({ nodeId: step.nodeId, routeId: step.routeId });
    }
  };
  const toggleEntries = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };

  return (
    <article
      role={canFocus ? "button" : undefined}
      tabIndex={canFocus ? 0 : undefined}
      onClick={handleFocus}
      onKeyDown={(event) => {
        if (canFocus && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleFocus();
        }
      }}
      className={cn(
        "relative rounded-lg border p-3 text-left transition",
        isActive
          ? "border-primary/45 bg-primary/10 shadow-primary/10 shadow-lg"
          : "app-surface-soft border-border/70",
        canFocus && "hover:border-primary/40 cursor-pointer",
      )}
    >
      <div className="bg-border absolute top-3 left-[-7px] h-[calc(100%-1.5rem)] w-px" />
      <div
        className={cn(
          "border-background absolute top-5 left-[-11px] size-2.5 rounded-full border-2",
          isActive ? "bg-primary" : step.status === "completed" ? "bg-emerald-500" : "bg-muted",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span className="bg-muted rounded px-1.5 py-0.5">Step {step.index}</span>
            <span className="bg-muted rounded px-1.5 py-0.5">
              {getTimelineStatusLabel(step.status)}
            </span>
            <span className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums">
              <ClockIcon className="size-3" />
              {formatDuration(step.durationMs)}
            </span>
            {step.usage.totalTokens > 0 && (
              <span className="bg-muted rounded px-1.5 py-0.5 tabular-nums">
                Token {formatTokenCount(step.usage.totalTokens)}
              </span>
            )}
            {step.usage.models.length > 0 && (
              <span className="bg-muted rounded px-1.5 py-0.5">
                {formatModelSummary(step.usage.models)}
              </span>
            )}
          </div>
          <h3 className="text-foreground mt-2 line-clamp-2 text-sm leading-5 font-semibold">
            {step.title}
          </h3>
        </div>
        {isActive && (
          <span className="bg-primary text-primary-foreground rounded px-2 py-1 text-[11px] font-semibold">
            进行中
          </span>
        )}
      </div>

      {step.summary && (
        <p className="text-muted-foreground mt-2 line-clamp-3 text-xs leading-5">{step.summary}</p>
      )}

      {visibleEntries.length > 0 && (
        <div className="border-border/70 mt-3 space-y-2 border-t pt-2">
          {entriesToRender.map((entry) => (
            <TimelineEntryRow key={entry.id} entry={entry} />
          ))}
          {hasFoldedEntries && (
            <button
              type="button"
              className="text-primary hover:bg-primary/10 w-full rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition"
              onClick={toggleEntries}
            >
              {isExpanded ? "收起记录" : `展开全部 ${visibleEntries.length} 条记录`}
            </button>
          )}
        </div>
      )}
      {canFocus && (
        <p className="text-primary mt-2 text-[11px] font-semibold">点击定位关联地图对象</p>
      )}
    </article>
  );
};

const TimelineEntryRow = ({ entry }: { entry: ThinkingTimelineEntry }) => (
  <div className="bg-background/55 rounded-md px-2.5 py-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-foreground line-clamp-1 text-xs font-semibold">{entry.title}</p>
        {entry.summary && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-4">
            {entry.summary}
          </p>
        )}
      </div>
      <span className="bg-muted text-muted-foreground flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold">
        {getTimelineKindIcon(entry)}
        {getTimelineKindLabel(entry)}
      </span>
    </div>
    {entry.recordedFacts && entry.recordedFacts.length > 0 && (
      <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px]">
        {entry.recordedFacts.join(" · ")}
      </p>
    )}
    {entry.usage && (
      <p className="text-muted-foreground mt-1 line-clamp-1 text-[11px] tabular-nums">
        {formatUsageLine(entry.usage)}
      </p>
    )}
    {entry.annotation?.url && (
      <a
        href={entry.annotation.url}
        target="_blank"
        rel="noreferrer"
        className="text-primary mt-1 inline-flex items-center gap-1 text-[11px] font-semibold"
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLinkIcon className="size-3" />
        查看素材
      </a>
    )}
  </div>
);

const MapEventDock = ({
  state,
  latestEvent,
}: {
  state: MapPlanningState;
  latestEvent?: PublicPlanningEvent;
}) => {
  const selectedRoutes = Object.values(state.routes).filter((item) => item.status === "selected");
  const latest = latestEvent;

  return (
    <div className="absolute right-3 bottom-3 left-3 z-20 grid gap-2 md:right-4 md:bottom-4 md:left-4 md:grid-cols-[minmax(0,1fr)_360px] md:gap-3">
      <div className="app-surface rounded-lg px-3 py-2 md:px-4 md:py-3">
        <p className="text-foreground text-sm font-semibold">
          {latest?.publicAction || "地图待命"}
        </p>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
          {latest?.thoughtSummary || latest?.message || "规划事件会直接落在地图点、路线和弹框上。"}
        </p>
      </div>
      <div className="app-surface hidden rounded-lg px-3 py-2 min-[430px]:block md:px-4 md:py-3">
        <p className="text-muted-foreground text-xs font-semibold">推荐路线</p>
        <p className="text-foreground mt-1 text-sm font-semibold">
          {selectedRoutes[0]?.route.label || "等待路线选择"}
        </p>
        <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
          {selectedRoutes[0]
            ? `${routeAccuracyLabel(selectedRoutes[0].route)} · ${
                selectedRoutes[0].route.reason || "候选路线出现后会在这里显示权衡结果。"
              }`
            : "候选路线出现后会在这里显示权衡结果。"}
        </p>
      </div>
    </div>
  );
};

const MapLegend = ({ routes, points }: { routes: MapRouteState[]; points: MapPointState[] }) => {
  const sampleRoute = routes.find((item) => item.route.phaseSeq || item.route.phaseId);
  const samplePoint = points.find((item) => item.point.dayIndex || item.point.phaseSeq);
  const phaseColor = phaseColorForMeta(
    sampleRoute?.route.phaseSeq ?? samplePoint?.point.phaseSeq,
    sampleRoute?.route.phaseId ?? samplePoint?.point.phaseId,
  );
  const dayColor = dayColorForMeta(
    sampleRoute?.route.dayIndex ?? samplePoint?.point.dayIndex,
    sampleRoute?.route.phaseSeq ?? samplePoint?.point.phaseSeq,
    sampleRoute?.route.phaseId ?? samplePoint?.point.phaseId,
  );

  return (
    <div className="app-surface absolute top-[6.75rem] right-3 left-3 z-20 rounded-lg px-3 py-2 md:top-[5.25rem] md:right-auto md:left-4 md:max-w-[360px]">
      <div className="text-muted-foreground grid grid-cols-2 gap-1.5 text-[10px] font-semibold min-[430px]:text-[11px] md:grid-cols-1">
        <LegendRow color={phaseColor} label="阶段主线" />
        <LegendRow color={dayColor} label="当日路线" />
        <LegendRow color={dayColor} label="待复核连接" dashed />
        <LegendRow color={phaseColor} label="阶段方向线" dashed muted />
      </div>
    </div>
  );
};

const LegendRow = ({
  color,
  label,
  dashed,
  muted,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  muted?: boolean;
}) => (
  <div className="flex items-center gap-2">
    <span
      className="h-0.5 w-9 rounded-full"
      style={{
        backgroundImage: dashed
          ? `repeating-linear-gradient(90deg, ${color} 0 8px, transparent 8px 13px)`
          : undefined,
        backgroundColor: dashed ? undefined : color,
        opacity: muted ? 0.62 : 1,
      }}
    />
    <span>{label}</span>
  </div>
);

interface TravelMapCanvasProps {
  points: MapPointState[];
  routes: MapRouteState[];
  pointsById: Record<string, MapPointState>;
  annotationsByNode: Record<string, MapAnnotationState[]>;
  focusTarget?: TimelineFocusTarget;
  isNightMode: boolean;
  isViewportLocked: boolean;
  viewportResetKey: number;
  onReadyChange: (ready: boolean) => void;
  onViewportLockedChange: (locked: boolean) => void;
}

const TravelMapCanvas = memo(function TravelMapCanvas({
  points,
  routes,
  pointsById,
  annotationsByNode,
  focusTarget,
  isNightMode,
  isViewportLocked,
  viewportResetKey,
  onReadyChange,
  onViewportLockedChange,
}: TravelMapCanvasProps) {
  const amapKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY;
  if (amapKey) {
    return (
      <AMapMapCanvas
        points={points}
        routes={routes}
        pointsById={pointsById}
        annotationsByNode={annotationsByNode}
        focusTarget={focusTarget}
        isNightMode={isNightMode}
        isViewportLocked={isViewportLocked}
        viewportResetKey={viewportResetKey}
        onReadyChange={onReadyChange}
        onViewportLockedChange={onViewportLockedChange}
      />
    );
  }

  return (
    <LeafletMapCanvas
      points={points}
      routes={routes}
      pointsById={pointsById}
      annotationsByNode={annotationsByNode}
      focusTarget={focusTarget}
      isNightMode={isNightMode}
      isViewportLocked={isViewportLocked}
      viewportResetKey={viewportResetKey}
      onReadyChange={onReadyChange}
      onViewportLockedChange={onViewportLockedChange}
    />
  );
});

const AMapMapCanvas = ({
  points,
  routes,
  pointsById,
  annotationsByNode,
  focusTarget,
  isNightMode,
  isViewportLocked,
  viewportResetKey,
  onReadyChange,
  onViewportLockedChange,
}: {
  points: MapPointState[];
  routes: MapRouteState[];
  pointsById: Record<string, MapPointState>;
  annotationsByNode: Record<string, MapAnnotationState[]>;
  focusTarget?: TimelineFocusTarget;
  isNightMode: boolean;
  isViewportLocked: boolean;
  viewportResetKey: number;
  onReadyChange: (ready: boolean) => void;
  onViewportLockedChange: (locked: boolean) => void;
}) => {
  const amapKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const amapRef = useRef<any>(null);
  const markerRefs = useRef<Map<string, any>>(new Map());
  const routeRefs = useRef<Map<string, any>>(new Map());
  const routeLabelRefs = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const pointPopupContentRefs = useRef<Map<string, string>>(new Map());
  const pointPopupPositionRefs = useRef<Map<string, [number, number]>>(new Map());
  const routePopupContentRefs = useRef<Map<string, string>>(new Map());
  const routePopupPositionRefs = useRef<Map<string, [number, number]>>(new Map());
  const firstFitDoneRef = useRef(false);
  const lastViewportSignatureRef = useRef("");
  const lastViewportResetKeyRef = useRef(viewportResetKey);
  const programmaticViewportChangeRef = useRef(false);
  const programmaticViewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAmapStyleRef = useRef(getAmapStyle(isNightMode));
  const [isReady, setIsReady] = useState(false);

  const runProgrammaticViewportChange = useCallback((action: () => void) => {
    if (programmaticViewportTimerRef.current) {
      clearTimeout(programmaticViewportTimerRef.current);
    }
    programmaticViewportChangeRef.current = true;
    try {
      action();
    } finally {
      programmaticViewportTimerRef.current = setTimeout(() => {
        programmaticViewportChangeRef.current = false;
        programmaticViewportTimerRef.current = null;
      }, VIEWPORT_PROGRAMMATIC_GUARD_MS);
    }
  }, []);

  useEffect(() => {
    const nextStyle = getAmapStyle(isNightMode);
    if (currentAmapStyleRef.current !== nextStyle) {
      currentAmapStyleRef.current = nextStyle;
      amapRef.current?.setMapStyle?.(nextStyle);
    }
  }, [isNightMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const lockFromUserInput = () => onViewportLockedChange(true);
    const lockFromKeyboard = (event: KeyboardEvent) => {
      if (USER_VIEWPORT_LOCK_KEYS.has(event.key)) {
        lockFromUserInput();
      }
    };
    const listenerOptions = { capture: true, passive: true } as const;

    container.addEventListener("pointerdown", lockFromUserInput, listenerOptions);
    container.addEventListener("wheel", lockFromUserInput, listenerOptions);
    container.addEventListener("touchstart", lockFromUserInput, listenerOptions);
    container.addEventListener("keydown", lockFromKeyboard, true);
    return () => {
      container.removeEventListener("pointerdown", lockFromUserInput, listenerOptions);
      container.removeEventListener("wheel", lockFromUserInput, listenerOptions);
      container.removeEventListener("touchstart", lockFromUserInput, listenerOptions);
      container.removeEventListener("keydown", lockFromKeyboard, true);
    };
  }, [onViewportLockedChange]);

  useEffect(() => {
    if (!amapKey || !containerRef.current) {
      return;
    }

    onReadyChange(false);
    const markers = markerRefs.current;
    const routeOverlays = routeRefs.current;
    const routeLabels = routeLabelRefs.current;
    const pointPopupContents = pointPopupContentRefs.current;
    const pointPopupPositions = pointPopupPositionRefs.current;
    const routePopupContents = routePopupContentRefs.current;
    const routePopupPositions = routePopupPositionRefs.current;
    let disposed = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;
    void loadAmap(amapKey).then(() => {
      if (disposed || !containerRef.current || !window.AMap) {
        return;
      }
      const AMap = window.AMap;
      if (!amapRef.current) {
        amapRef.current = new AMap.Map(containerRef.current, {
          zoom: 5,
          center: [104.2, 35.9],
          viewMode: "2D",
          mapStyle: currentAmapStyleRef.current,
        });
      }
      const markReady = () => {
        if (!disposed) {
          setIsReady(true);
          onReadyChange(true);
        }
      };
      amapRef.current?.on?.("complete", markReady);
      amapRef.current?.on?.("tilesloaded", markReady);
      readyTimer = setTimeout(markReady, 1400);
      setIsReady(true);
    });

    return () => {
      disposed = true;
      onReadyChange(false);
      if (readyTimer) {
        clearTimeout(readyTimer);
      }
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = null;
      }
      if (programmaticViewportTimerRef.current) {
        clearTimeout(programmaticViewportTimerRef.current);
        programmaticViewportTimerRef.current = null;
      }
      programmaticViewportChangeRef.current = false;
      infoWindowRef.current?.close?.();
      infoWindowRef.current = null;
      markers.clear();
      routeOverlays.clear();
      routeLabels.clear();
      pointPopupContents.clear();
      pointPopupPositions.clear();
      routePopupContents.clear();
      routePopupPositions.clear();
      amapRef.current?.destroy?.();
      amapRef.current = null;
    };
  }, [amapKey, onReadyChange]);

  useEffect(() => {
    if (!isReady || !amapRef.current) {
      return;
    }
    const map = amapRef.current;
    const markUserViewportLocked = () => {
      if (!programmaticViewportChangeRef.current) {
        onViewportLockedChange(true);
      }
    };

    map.on?.("zoomstart", markUserViewportLocked);
    map.on?.("movestart", markUserViewportLocked);
    map.on?.("dragstart", markUserViewportLocked);
    return () => {
      map.off?.("zoomstart", markUserViewportLocked);
      map.off?.("movestart", markUserViewportLocked);
      map.off?.("dragstart", markUserViewportLocked);
    };
  }, [isReady, onViewportLockedChange]);

  useEffect(() => {
    if (!isReady || !amapRef.current) {
      return;
    }
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeMap = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(() => {
        amapRef.current?.resize?.();
        resizeTimer = null;
      }, VIEWPORT_DEBOUNCE_MS);
    };

    resizeMap();
    window.addEventListener("resize", resizeMap);
    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      window.removeEventListener("resize", resizeMap);
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !amapRef.current || !window.AMap) {
      return;
    }

    const AMap = window.AMap;
    const map = amapRef.current;
    const activeRouteIds = new Set<string>();

    routes.forEach((item) => {
      const path = item.route.polyline ?? [];
      if (path.length < 2) {
        return;
      }
      activeRouteIds.add(item.id);
      const options = amapRouteOptions(item);
      const labelPosition = routeLabelPosition(path);
      const labelContent = renderRouteBadgeHTML(item, pointsById);
      const routePopupContent = renderRoutePopupHTML(item, pointsById);
      routePopupContentRefs.current.set(item.id, routePopupContent);
      if (labelPosition) {
        routePopupPositionRefs.current.set(item.id, labelPosition);
      } else {
        routePopupPositionRefs.current.delete(item.id);
      }
      const openRoutePopup = () => {
        const currentPosition = routePopupPositionRefs.current.get(item.id);
        const currentContent = routePopupContentRefs.current.get(item.id);
        if (!currentPosition || !currentContent) {
          return;
        }
        if (!infoWindowRef.current) {
          infoWindowRef.current = new AMap.InfoWindow({
            isCustom: false,
            offset: new AMap.Pixel(0, -18),
          });
        }
        infoWindowRef.current.setContent?.(currentContent);
        infoWindowRef.current.open?.(map, currentPosition);
      };
      const existing = routeRefs.current.get(item.id);
      if (existing) {
        existing.setPath?.(path);
        existing.setOptions?.(options);
      } else {
        const polyline = new AMap.Polyline({
          path,
          ...options,
        });
        map.add(polyline);
        polyline.on?.("click", openRoutePopup);
        routeRefs.current.set(item.id, polyline);
      }
      if (labelPosition) {
        const existingLabel = routeLabelRefs.current.get(item.id);
        if (existingLabel) {
          existingLabel.setPosition?.(labelPosition);
          existingLabel.setContent?.(labelContent);
          existingLabel.setzIndex?.(item.status === "dimmed" ? 25 : 130);
          existingLabel.setOptions?.({ zIndex: item.status === "dimmed" ? 25 : 130 });
        } else {
          const routeLabel = new AMap.Marker({
            position: labelPosition,
            content: labelContent,
            offset: new AMap.Pixel(-48, -14),
            zIndex: item.status === "dimmed" ? 25 : 130,
          });
          routeLabel.on?.("click", openRoutePopup);
          map.add(routeLabel);
          routeLabelRefs.current.set(item.id, routeLabel);
        }
      }
    });

    routeRefs.current.forEach((polyline, id) => {
      if (!activeRouteIds.has(id)) {
        map.remove(polyline);
        routeRefs.current.delete(id);
        routePopupContentRefs.current.delete(id);
        routePopupPositionRefs.current.delete(id);
      }
    });
    routeLabelRefs.current.forEach((label, id) => {
      if (!activeRouteIds.has(id)) {
        map.remove(label);
        routeLabelRefs.current.delete(id);
      }
    });

    const activePointIds = new Set<string>();
    points.forEach((item) => {
      activePointIds.add(item.id);
      const position = [item.point.lng, item.point.lat];
      const annotations = annotationsByNode[item.id] ?? [];
      const content = renderMarkerHTML(item, annotations);
      const popupContent = renderLeafletPopupHTML(item, annotations);
      pointPopupContentRefs.current.set(item.id, popupContent);
      pointPopupPositionRefs.current.set(item.id, position as [number, number]);
      const openPointPopup = () => {
        const currentPosition = pointPopupPositionRefs.current.get(item.id);
        const currentContent = pointPopupContentRefs.current.get(item.id);
        if (!currentPosition || !currentContent) {
          return;
        }
        if (!infoWindowRef.current) {
          infoWindowRef.current = new AMap.InfoWindow({
            isCustom: false,
            offset: new AMap.Pixel(0, -24),
          });
        }
        infoWindowRef.current.setContent?.(currentContent);
        infoWindowRef.current.open?.(map, currentPosition);
      };
      const zIndex = item.status === "dimmed" ? 20 : 100;
      const existing = markerRefs.current.get(item.id);
      if (existing) {
        existing.setPosition?.(position);
        existing.setContent?.(content);
        existing.setzIndex?.(zIndex);
        existing.setOptions?.({ zIndex });
      } else {
        const marker = new AMap.Marker({
          position,
          content,
          offset: new AMap.Pixel(-16, -16),
          zIndex,
        });
        marker.on?.("click", openPointPopup);
        map.add(marker);
        markerRefs.current.set(item.id, marker);
      }
    });

    markerRefs.current.forEach((marker, id) => {
      if (!activePointIds.has(id)) {
        map.remove(marker);
        markerRefs.current.delete(id);
        pointPopupContentRefs.current.delete(id);
        pointPopupPositionRefs.current.delete(id);
      }
    });
  }, [annotationsByNode, isReady, points, pointsById, routes]);

  const geometrySignature = useMemo(
    () => `${pointGeometrySignature(points)}|${routeGeometrySignature(routes)}`,
    [points, routes],
  );

  useEffect(() => {
    if (points.length === 0 && routes.length === 0) {
      firstFitDoneRef.current = false;
      lastViewportSignatureRef.current = "";
    }
  }, [points.length, routes.length]);

  useEffect(() => {
    if (!isReady || !amapRef.current) {
      return;
    }
    if (viewportResetKey === lastViewportResetKeyRef.current) {
      return;
    }
    lastViewportResetKeyRef.current = viewportResetKey;
    const overlays = [...routeRefs.current.values(), ...markerRefs.current.values()];
    if (overlays.length === 0) {
      return;
    }

    const signature = `geometry:${geometrySignature}`;
    runProgrammaticViewportChange(() => {
      amapRef.current?.resize?.();
      amapRef.current?.setFitView?.(overlays, false, [80, 80, 80, 440]);
    });
    firstFitDoneRef.current = true;
    lastViewportSignatureRef.current = signature;
  }, [geometrySignature, isReady, runProgrammaticViewportChange, viewportResetKey]);

  useEffect(() => {
    if (!isReady || !amapRef.current) {
      return;
    }
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current);
    }
    viewportTimerRef.current = setTimeout(() => {
      const map = amapRef.current;
      if (!map) {
        return;
      }
      const signature = `geometry:${geometrySignature}`;
      if (signature === lastViewportSignatureRef.current) {
        return;
      }
      if (
        isViewportLocked ||
        firstFitDoneRef.current ||
        (points.length === 0 && routes.length === 0)
      ) {
        lastViewportSignatureRef.current = signature;
        return;
      }

      const overlays = [...routeRefs.current.values(), ...markerRefs.current.values()];
      if (overlays.length > 0) {
        runProgrammaticViewportChange(() => {
          map.setFitView?.(overlays, false, [80, 80, 80, 440]);
        });
        firstFitDoneRef.current = true;
      }
      lastViewportSignatureRef.current = signature;
    }, 200);

    return () => {
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = null;
      }
    };
  }, [geometrySignature, isReady, isViewportLocked, points, routes, runProgrammaticViewportChange]);

  useEffect(() => {
    if (!isReady || !amapRef.current || !focusTarget) {
      return;
    }
    const map = amapRef.current;
    if (focusTarget.nodeId) {
      const marker = markerRefs.current.get(focusTarget.nodeId);
      const position = marker?.getPosition?.();
      if (position) {
        const point = points.find((item) => item.id === focusTarget.nodeId);
        const baseZIndex = point?.status === "dimmed" ? 20 : 100;
        marker?.setzIndex?.(1000);
        marker?.setOptions?.({ zIndex: 1000 });
        window.setTimeout(() => {
          marker?.setzIndex?.(baseZIndex);
          marker?.setOptions?.({ zIndex: baseZIndex });
        }, 1400);
        runProgrammaticViewportChange(() => {
          map.panTo?.(position);
        });
        return;
      }
    }
    if (focusTarget.routeId) {
      const polyline = routeRefs.current.get(focusTarget.routeId);
      if (polyline) {
        const route = routes.find((item) => item.id === focusTarget.routeId);
        polyline.setOptions?.({
          strokeColor: "#f05a28",
          strokeOpacity: 1,
          strokeWeight: 10,
        });
        window.setTimeout(() => {
          if (route) {
            polyline.setOptions?.(amapRouteOptions(route));
          }
        }, 1400);
        runProgrammaticViewportChange(() => {
          map.setFitView?.([polyline], false, [80, 80, 80, 440]);
        });
      }
    }
  }, [focusTarget, isReady, points, routes, runProgrammaticViewportChange]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn("bg-muted absolute inset-0", isNightMode && "travel-map-canvas-night")}
    />
  );
};

const LeafletMapCanvas = ({
  points,
  routes,
  pointsById,
  annotationsByNode,
  focusTarget,
  isNightMode,
  isViewportLocked,
  viewportResetKey,
  onReadyChange,
  onViewportLockedChange,
}: {
  points: MapPointState[];
  routes: MapRouteState[];
  pointsById: Record<string, MapPointState>;
  annotationsByNode: Record<string, MapAnnotationState[]>;
  focusTarget?: TimelineFocusTarget;
  isNightMode: boolean;
  isViewportLocked: boolean;
  viewportResetKey: number;
  onReadyChange: (ready: boolean) => void;
  onViewportLockedChange: (locked: boolean) => void;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const tileUrlRef = useRef("");
  const tileAttributionRef = useRef("");
  const markerRefs = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const routeRefs = useRef<Map<string, import("leaflet").Polyline>>(new Map());
  const routeLabelRefs = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const firstFitDoneRef = useRef(false);
  const lastViewportSignatureRef = useRef("");
  const lastViewportResetKeyRef = useRef(viewportResetKey);
  const programmaticViewportChangeRef = useRef(false);
  const programmaticViewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestNightModeRef = useRef(isNightMode);
  const [loadError, setLoadError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const runProgrammaticViewportChange = useCallback((action: () => void) => {
    if (programmaticViewportTimerRef.current) {
      clearTimeout(programmaticViewportTimerRef.current);
    }
    programmaticViewportChangeRef.current = true;
    try {
      action();
    } finally {
      programmaticViewportTimerRef.current = setTimeout(() => {
        programmaticViewportChangeRef.current = false;
        programmaticViewportTimerRef.current = null;
      }, VIEWPORT_PROGRAMMATIC_GUARD_MS);
    }
  }, []);

  useEffect(() => {
    latestNightModeRef.current = isNightMode;
    const tileLayer = tileLayerRef.current;
    const map = mapRef.current;
    if (!tileLayer) {
      return;
    }

    const nextTileLayer = getLeafletTileLayer(isNightMode);
    if (tileUrlRef.current !== nextTileLayer.url) {
      tileUrlRef.current = nextTileLayer.url;
      tileLayer.setUrl(nextTileLayer.url);
    }
    if (tileAttributionRef.current !== nextTileLayer.attribution) {
      map?.attributionControl?.removeAttribution(tileAttributionRef.current);
      map?.attributionControl?.addAttribution(nextTileLayer.attribution);
      tileLayer.options.attribution = nextTileLayer.attribution;
      tileAttributionRef.current = nextTileLayer.attribution;
    }
  }, [isNightMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const lockFromUserInput = () => onViewportLockedChange(true);
    const lockFromKeyboard = (event: KeyboardEvent) => {
      if (USER_VIEWPORT_LOCK_KEYS.has(event.key)) {
        lockFromUserInput();
      }
    };
    const listenerOptions = { capture: true, passive: true } as const;

    container.addEventListener("pointerdown", lockFromUserInput, listenerOptions);
    container.addEventListener("wheel", lockFromUserInput, listenerOptions);
    container.addEventListener("touchstart", lockFromUserInput, listenerOptions);
    container.addEventListener("keydown", lockFromKeyboard, true);
    return () => {
      container.removeEventListener("pointerdown", lockFromUserInput, listenerOptions);
      container.removeEventListener("wheel", lockFromUserInput, listenerOptions);
      container.removeEventListener("touchstart", lockFromUserInput, listenerOptions);
      container.removeEventListener("keydown", lockFromKeyboard, true);
    };
  }, [onViewportLockedChange]);

  useEffect(() => {
    onReadyChange(false);
    const markers = markerRefs.current;
    const routeOverlays = routeRefs.current;
    const routeLabels = routeLabelRefs.current;
    let disposed = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    void import("leaflet")
      .then((L) => {
        if (disposed || !containerRef.current) {
          return;
        }

        setLoadError(false);
        if (!mapRef.current) {
          const map = L.map(containerRef.current, {
            center: [35.9, 104.2],
            zoom: 4,
            zoomControl: true,
            attributionControl: true,
          });

          const tileLayerConfig = getLeafletTileLayer(latestNightModeRef.current);
          const tileLayer = L.tileLayer(tileLayerConfig.url, {
            maxZoom: 19,
            attribution: tileLayerConfig.attribution,
          });
          tileLayerRef.current = tileLayer;
          tileUrlRef.current = tileLayerConfig.url;
          tileAttributionRef.current = tileLayerConfig.attribution;
          const markReady = () => {
            if (!disposed) {
              setIsReady(true);
              onReadyChange(true);
            }
          };
          tileLayer.once("load", markReady);
          tileLayer.addTo(map);
          map.whenReady(markReady);
          readyTimer = setTimeout(markReady, 1400);

          leafletRef.current = L;
          mapRef.current = map;
        }
        setIsReady(true);
      })
      .catch(() => {
        if (!disposed) {
          setLoadError(true);
        }
      });

    return () => {
      disposed = true;
      onReadyChange(false);
      if (readyTimer) {
        clearTimeout(readyTimer);
      }
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = null;
      }
      if (programmaticViewportTimerRef.current) {
        clearTimeout(programmaticViewportTimerRef.current);
        programmaticViewportTimerRef.current = null;
      }
      programmaticViewportChangeRef.current = false;
      markers.clear();
      routeOverlays.clear();
      routeLabels.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      tileLayerRef.current = null;
      tileUrlRef.current = "";
      tileAttributionRef.current = "";
    };
  }, [onReadyChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isReady || !map) {
      return;
    }
    const markUserViewportLocked = () => {
      if (!programmaticViewportChangeRef.current) {
        onViewportLockedChange(true);
      }
    };

    map.on("zoomstart", markUserViewportLocked);
    map.on("movestart", markUserViewportLocked);
    map.on("dragstart", markUserViewportLocked);
    return () => {
      map.off("zoomstart", markUserViewportLocked);
      map.off("movestart", markUserViewportLocked);
      map.off("dragstart", markUserViewportLocked);
    };
  }, [isReady, onViewportLockedChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isReady || !map) {
      return;
    }
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const invalidateMapSize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(() => {
        map.invalidateSize();
        resizeTimer = null;
      }, VIEWPORT_DEBOUNCE_MS);
    };

    requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener("resize", invalidateMapSize);
    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      window.removeEventListener("resize", invalidateMapSize);
    };
  }, [isReady]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!isReady || !L || !map) {
      return;
    }

    const activeRouteIds = new Set<string>();
    const activeRouteLabelIds = new Set<string>();
    routes.forEach((item) => {
      const path = item.route.polyline ?? [];
      if (path.length < 2) {
        return;
      }
      activeRouteIds.add(item.id);
      const latLngs = path.map(([lng, lat]) => L.latLng(lat, lng));
      const existing = routeRefs.current.get(item.id);
      const badgeHTML = renderLeafletRouteTooltipHTML(item, pointsById);
      const popupHTML = renderRoutePopupHTML(item, pointsById);
      if (existing) {
        existing.setLatLngs(latLngs);
        existing.setStyle(leafletRouteStyle(item));
        existing.unbindPopup();
        existing.bindPopup(popupHTML, {
          className: "travel-leaflet-popup",
          maxWidth: 360,
        });
      } else {
        const polyline = L.polyline(latLngs, leafletRouteStyle(item)).addTo(map);
        polyline.bindPopup(popupHTML, {
          className: "travel-leaflet-popup",
          maxWidth: 360,
        });
        routeRefs.current.set(item.id, polyline);
      }

      const labelPosition = routeLabelPosition(path);
      if (labelPosition) {
        activeRouteLabelIds.add(item.id);
        const [lng, lat] = labelPosition;
        const labelLatLng = L.latLng(lat, lng);
        const labelIcon = L.divIcon({
          className: "travel-leaflet-route-label",
          html: badgeHTML,
          iconSize: [156, 34],
          iconAnchor: [78, 17],
        });
        const existingLabel = routeLabelRefs.current.get(item.id);
        const labelMarker =
          existingLabel ??
          L.marker(labelLatLng, {
            icon: labelIcon,
            zIndexOffset: item.status === "dimmed" ? 20 : 520,
          }).addTo(map);

        labelMarker.setLatLng(labelLatLng);
        labelMarker.setIcon(labelIcon);
        labelMarker.setZIndexOffset(item.status === "dimmed" ? 20 : 520);
        labelMarker.unbindPopup();
        labelMarker.bindPopup(popupHTML, {
          className: "travel-leaflet-popup",
          maxWidth: 360,
        });
        routeLabelRefs.current.set(item.id, labelMarker);
      }
    });

    routeRefs.current.forEach((polyline, id) => {
      if (!activeRouteIds.has(id)) {
        map.removeLayer(polyline);
        routeRefs.current.delete(id);
      }
    });
    routeLabelRefs.current.forEach((label, id) => {
      if (!activeRouteLabelIds.has(id)) {
        map.removeLayer(label);
        routeLabelRefs.current.delete(id);
      }
    });

    const activePointIds = new Set<string>();
    points.forEach((item) => {
      activePointIds.add(item.id);
      const relatedAnnotations = annotationsByNode[item.id] ?? [];
      const latLng = L.latLng(item.point.lat, item.point.lng);
      const icon = L.divIcon({
        className: "travel-leaflet-marker",
        html: renderLeafletMarkerHTML(item, relatedAnnotations),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const existing = markerRefs.current.get(item.id);
      const marker =
        existing ??
        L.marker(latLng, {
          icon,
          zIndexOffset: item.status === "dimmed" ? 0 : 600,
        }).addTo(map);

      marker.setLatLng(latLng);
      marker.setIcon(icon);
      marker.setZIndexOffset(item.status === "dimmed" ? 0 : 600);
      marker.unbindTooltip();
      marker.unbindPopup();
      marker.bindTooltip(renderLeafletCalloutHTML(item, relatedAnnotations), {
        permanent: true,
        interactive: true,
        direction: "right",
        offset: [16, 0],
        opacity: item.status === "dimmed" ? 0.58 : 1,
        className: "travel-leaflet-callout",
      });
      marker.bindPopup(renderLeafletPopupHTML(item, relatedAnnotations), {
        className: "travel-leaflet-popup",
        maxWidth: 360,
      });
      markerRefs.current.set(item.id, marker);
    });

    markerRefs.current.forEach((marker, id) => {
      if (!activePointIds.has(id)) {
        map.removeLayer(marker);
        markerRefs.current.delete(id);
      }
    });
  }, [annotationsByNode, isReady, points, pointsById, routes]);

  const geometrySignature = useMemo(
    () => `${pointGeometrySignature(points)}|${routeGeometrySignature(routes)}`,
    [points, routes],
  );

  useEffect(() => {
    if (points.length === 0 && routes.length === 0) {
      firstFitDoneRef.current = false;
      lastViewportSignatureRef.current = "";
    }
  }, [points.length, routes.length]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!isReady || !L || !map) {
      return;
    }
    if (viewportResetKey === lastViewportResetKeyRef.current) {
      return;
    }
    lastViewportResetKeyRef.current = viewportResetKey;
    const bounds = leafletGeometryBounds(L, points, routes);
    if (!bounds.isValid()) {
      return;
    }

    const signature = `geometry:${geometrySignature}`;
    runProgrammaticViewportChange(() => {
      map.invalidateSize();
      map.fitBounds(bounds, {
        animate: true,
        maxZoom: points.length === 1 ? 11 : 8,
        padding: [64, 64],
      });
    });
    firstFitDoneRef.current = true;
    lastViewportSignatureRef.current = signature;
  }, [geometrySignature, isReady, points, routes, runProgrammaticViewportChange, viewportResetKey]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!isReady || !L || !map) {
      return;
    }
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current);
    }

    viewportTimerRef.current = setTimeout(() => {
      const signature = `geometry:${geometrySignature}`;
      if (signature === lastViewportSignatureRef.current) {
        return;
      }
      if (
        isViewportLocked ||
        firstFitDoneRef.current ||
        (points.length === 0 && routes.length === 0)
      ) {
        lastViewportSignatureRef.current = signature;
        return;
      }

      const bounds = leafletGeometryBounds(L, points, routes);
      if (bounds.isValid()) {
        runProgrammaticViewportChange(() => {
          map.fitBounds(bounds, {
            animate: true,
            maxZoom: points.length === 1 ? 11 : 7,
            padding: [48, 48],
          });
        });
        firstFitDoneRef.current = true;
      }
      lastViewportSignatureRef.current = signature;
    }, 200);

    return () => {
      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = null;
      }
    };
  }, [geometrySignature, isReady, isViewportLocked, points, routes, runProgrammaticViewportChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isReady || !map || !focusTarget) {
      return;
    }
    if (focusTarget.nodeId) {
      const marker = markerRefs.current.get(focusTarget.nodeId);
      if (marker) {
        const markerElement = marker.getElement();
        markerElement?.classList.add("travel-map-focus-pulse");
        window.setTimeout(() => markerElement?.classList.remove("travel-map-focus-pulse"), 1400);
        runProgrammaticViewportChange(() => {
          map.panTo(marker.getLatLng(), { animate: true });
        });
        marker.openPopup();
        return;
      }
    }
    if (focusTarget.routeId) {
      const polyline = routeRefs.current.get(focusTarget.routeId);
      if (polyline) {
        const route = routes.find((item) => item.id === focusTarget.routeId);
        polyline.setStyle({
          color: "#f05a28",
          opacity: 1,
          weight: 10,
        });
        polyline.getElement()?.classList.add("travel-map-focus-pulse");
        window.setTimeout(() => {
          if (route) {
            polyline.setStyle(leafletRouteStyle(route));
          }
          polyline.getElement()?.classList.remove("travel-map-focus-pulse");
        }, 1400);
        runProgrammaticViewportChange(() => {
          map.fitBounds(polyline.getBounds(), {
            animate: true,
            paddingTopLeft: [440, 80],
            paddingBottomRight: [80, 80],
            maxZoom: 11,
          });
        });
      }
    }
  }, [focusTarget, isReady, routes, runProgrammaticViewportChange]);

  if (loadError) {
    return (
      <div className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center px-6 text-center text-sm">
        地图加载失败，请稍后重试。
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn("bg-muted absolute inset-0", isNightMode && "travel-map-canvas-night")}
    />
  );
};

const PHASE_HUES = [207, 158, 328, 35, 258, 188, 12, 96, 226, 292];

const stableNumberFromString = (value?: string) => {
  if (!value) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const phaseHueForMeta = (phaseSeq?: number, phaseId?: string) => {
  const rawIndex = phaseSeq && phaseSeq > 0 ? phaseSeq - 1 : stableNumberFromString(phaseId);
  return PHASE_HUES[Math.abs(rawIndex) % PHASE_HUES.length];
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (value: number) =>
    Math.round(255 * value)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

const phaseColorForMeta = (phaseSeq?: number, phaseId?: string) =>
  hslToHex(phaseHueForMeta(phaseSeq, phaseId), 68, 44);

const dayColorForMeta = (dayIndex?: number, phaseSeq?: number, phaseId?: string) => {
  if (!dayIndex || dayIndex <= 0) {
    return phaseColorForMeta(phaseSeq, phaseId);
  }
  const baseHue = phaseHueForMeta(phaseSeq, phaseId);
  const offset = ((dayIndex - 1) * 29) % 58;
  return hslToHex(baseHue - 29 + offset, 72, 48);
};

const routeVisualStyle = (item: MapRouteState) => {
  const route = item.route;
  const isDimmed = item.status === "dimmed";
  const isConnector = route.accuracy === "connector";
  const isDirectional = route.accuracy === "directional" || route.connectionType === "phase";
  const isCrossDay = route.connectionType === "cross_day";
  const isPhase = item.level === "overview" || route.connectionType === "phase";
  const color = isDimmed
    ? "#7f8c93"
    : isPhase
      ? phaseColorForMeta(route.phaseSeq, route.phaseId)
      : dayColorForMeta(route.dayIndex, route.phaseSeq, route.phaseId);
  const dashArray = isConnector ? "8 8" : isCrossDay ? "4 8" : isDirectional ? "12 10" : undefined;

  return {
    color,
    weight: isPhase ? 8 : item.status === "selected" ? 6 : 4,
    opacity: isDimmed ? 0.34 : isConnector ? 0.58 : isDirectional ? 0.48 : 0.88,
    dashArray,
    isDashed: Boolean(dashArray),
  };
};

const pointVisualColors = (item: MapPointState) => {
  const isDimmed = item.status === "dimmed";
  if (item.point.kind === "start") {
    return {
      fill: isDimmed ? "#7f8c93" : "#2079d6",
      ring: isDimmed ? "#9aa7ad" : "#79c1ff",
    };
  }
  return {
    fill: isDimmed
      ? "#7f8c93"
      : dayColorForMeta(item.point.dayIndex, item.point.phaseSeq, item.point.phaseId),
    ring: isDimmed ? "#9aa7ad" : phaseColorForMeta(item.point.phaseSeq, item.point.phaseId),
  };
};

function escapeHTML(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

function escapeHTMLWithBreaks(value: string) {
  return escapeHTML(value).replace(/\n/g, "<br />");
}

function firstNonEmptyText(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function uniqueTextRows(rows: Array<{ label: string; value: string }>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = row.value.trim();
    if (!value) {
      return false;
    }
    const key = `${row.label}:${value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

const routeAccuracyLabel = (route: MapRouteState["route"]) => {
  if (route.accuracy === "exact") {
    return "精确路线";
  }
  if (route.accuracy === "connector") {
    return "待复核连接";
  }
  if (route.accuracy === "directional") {
    return "阶段方向线";
  }
  return "路线";
};

const routeTransportLabel = (mode?: string) => {
  const normalized = (mode || "").toLowerCase();
  const labels: Record<string, string> = {
    auto: "自驾",
    car: "自驾",
    drive: "自驾",
    driving: "自驾",
    taxi: "打车",
    walk: "步行",
    walking: "步行",
    bike: "骑行",
    bicycle: "骑行",
    cycling: "骑行",
    bus: "公交",
    subway: "地铁",
    metro: "地铁",
    transit: "公共交通",
    train: "火车",
    rail: "火车",
    high_speed_rail: "高铁",
    flight: "飞机",
    plane: "飞机",
    ferry: "轮渡",
  };
  return labels[normalized] ?? (mode ? mode : "交通方式待定");
};

const routeConnectionLabel = (route: MapRouteState["route"], level: MapRouteState["level"]) => {
  if (route.connectionType === "cross_day") {
    return "跨天连接";
  }
  if (route.connectionType === "day_segment") {
    return "当日路段";
  }
  if (route.connectionType === "phase" || level === "overview") {
    return "阶段路线";
  }
  return "路段";
};

const formatDistance = (meters?: number) => {
  if (!meters || meters <= 0) {
    return "";
  }
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} 公里`;
  }
  return `${Math.round(meters)} 米`;
};

const formatRouteDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) {
    return "";
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = Math.round(minutes % 60);
    return restMinutes > 0 ? `${hours}小时${restMinutes}分钟` : `${hours}小时`;
  }
  return `${Math.round(minutes)} 分钟`;
};

const routeEndpointLabels = (
  route: MapRouteState["route"],
  pointsById: Record<string, MapPointState>,
) => {
  const from = route.fromNodeId ? pointsById[route.fromNodeId]?.point.label : "";
  const to = route.toNodeId ? pointsById[route.toNodeId]?.point.label : "";
  return { from, to };
};

const routeEndpointText = (
  route: MapRouteState["route"],
  pointsById: Record<string, MapPointState>,
) => {
  const { from, to } = routeEndpointLabels(route, pointsById);
  if (from && to) {
    return `${from} → ${to}`;
  }
  return firstNonEmptyText(route.label);
};

const routeSummaryText = (item: MapRouteState, pointsById: Record<string, MapPointState>) => {
  const route = item.route;
  const parts = [
    routeTransportLabel(route.mode),
    routeEndpointText(route, pointsById),
    formatDistance(route.distanceMeters),
    formatRouteDuration(route.durationMin),
  ].filter(Boolean);
  return parts.join(" · ");
};

const routeDetailRows = (item: MapRouteState, pointsById: Record<string, MapPointState>) => {
  const route = item.route;
  const endpoint = routeEndpointText(route, pointsById);
  return uniqueTextRows([
    { label: "交通", value: routeTransportLabel(route.mode) },
    { label: "路段", value: endpoint && endpoint !== route.label ? endpoint : "" },
    {
      label: "类型",
      value: `${routeAccuracyLabel(route)} · ${routeConnectionLabel(route, item.level)}`,
    },
    { label: "阶段", value: route.phaseName || "" },
    { label: "日期", value: route.dayIndex ? `Day ${route.dayIndex}` : "" },
    { label: "距离", value: formatDistance(route.distanceMeters) },
    { label: "用时", value: formatRouteDuration(route.durationMin) },
    {
      label: "费用",
      value: route.estimatedCost ? `约 ${Math.round(route.estimatedCost)} 元` : "",
    },
    { label: "取舍", value: firstNonEmptyText(item.reason, route.reason) },
  ]);
};

const routeLabelPosition = (path: Array<[number, number]>) => {
  if (path.length === 0) {
    return undefined;
  }
  const [lng, lat] = path[Math.floor(path.length / 2)];
  return [lng, lat] as [number, number];
};

const renderRouteBadgeHTML = (item: MapRouteState, pointsById: Record<string, MapPointState>) => {
  const route = item.route;
  const visual = routeVisualStyle(item);
  const compactMeta = [formatDistance(route.distanceMeters), formatRouteDuration(route.durationMin)]
    .filter(Boolean)
    .join(" · ");
  const title =
    routeEndpointText(route, pointsById) || route.label || routeTransportLabel(route.mode);
  return `<div title="${escapeHTML(title)}" style="max-width:156px;border:1px solid var(--border);border-radius:999px;background:var(--app-surface-elevated);box-shadow:0 8px 18px rgba(23,50,77,.14);padding:4px 7px;color:var(--foreground);opacity:${item.status === "dimmed" ? 0.62 : 0.92};cursor:pointer;">
    <div style="display:flex;align-items:center;gap:5px;min-width:0;font-size:10px;font-weight:800;line-height:1.2;">
      <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:${visual.color};flex:0 0 auto;"></span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(routeTransportLabel(route.mode))}</span>
      <span style="color:var(--muted-foreground);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(routeAccuracyLabel(route))}</span>
    </div>
    ${compactMeta ? `<div style="margin-top:1px;font-size:9px;line-height:1.2;color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(compactMeta)}</div>` : ""}
  </div>`;
};

const renderLeafletRouteTooltipHTML = (
  item: MapRouteState,
  pointsById: Record<string, MapPointState>,
) => renderRouteBadgeHTML(item, pointsById);

const renderMapPopupShellHTML = (content: string) =>
  `<div style="max-width:340px;max-height:360px;overflow-y:auto;padding:2px 0;color:var(--foreground);">${content}</div>`;

const renderRoutePopupHTML = (item: MapRouteState, pointsById: Record<string, MapPointState>) => {
  const route = item.route;
  const title = routeEndpointText(route, pointsById) || route.label;
  const summary = routeSummaryText(item, pointsById);
  const rows = routeDetailRows(item, pointsById);
  return renderMapPopupShellHTML(`<div>
    <div style="font-size:13px;font-weight:800;line-height:1.4;">${escapeHTML(title)}</div>
    <div style="margin-top:4px;font-size:11px;color:var(--primary);">${escapeHTML(routeTransportLabel(route.mode))} · ${escapeHTML(routeAccuracyLabel(route))}</div>
    ${summary ? `<div style="margin-top:8px;font-size:12px;line-height:1.55;color:var(--muted-foreground);">${escapeHTML(summary)}</div>` : ""}
    ${renderPointDetailRowsHTML(rows)}
  </div>`);
};

const pointMetaLine = (item: MapPointState) => {
  const parts = [
    item.point.phaseName,
    item.point.dayIndex ? `Day ${item.point.dayIndex}` : "",
    item.point.accuracy === "exact" ? "精确点位" : "",
  ].filter(Boolean);
  return parts.join(" · ");
};

const amapRouteOptions = (item: MapRouteState) => {
  const visual = routeVisualStyle(item);
  const isDimmed = item.status === "dimmed";
  return {
    strokeColor: visual.color,
    strokeWeight: visual.weight,
    strokeOpacity: visual.opacity,
    strokeStyle: isDimmed || visual.isDashed ? "dashed" : "solid",
  };
};

const leafletRouteStyle = (item: MapRouteState) => {
  const visual = routeVisualStyle(item);
  return {
    color: visual.color,
    weight: visual.weight,
    opacity: visual.opacity,
    dashArray: visual.dashArray,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  };
};

const pointGeometrySignature = (points: MapPointState[]) =>
  points
    .map((item) =>
      [
        item.id,
        item.status,
        item.point.lng,
        item.point.lat,
        item.point.label,
        item.point.phaseSeq,
        item.point.phaseId,
        item.point.dayIndex,
      ].join(":"),
    )
    .join("|");

const routeGeometrySignature = (routes: MapRouteState[]) =>
  routes
    .map((item) =>
      [
        item.id,
        item.status,
        item.route.accuracy,
        item.route.connectionType,
        item.route.phaseSeq,
        item.route.phaseId,
        item.route.dayIndex,
        item.route.polyline?.map(([lng, lat]) => `${lng},${lat}`).join(";") ?? "",
      ].join(":"),
    )
    .join("|");

const leafletGeometryBounds = (
  L: typeof import("leaflet"),
  points: MapPointState[],
  routes: MapRouteState[],
) => {
  const bounds = L.latLngBounds([]);
  routes.forEach((item) => {
    item.route.polyline?.forEach(([lng, lat]) => bounds.extend(L.latLng(lat, lng)));
  });
  points.forEach((item) => bounds.extend(L.latLng(item.point.lat, item.point.lng)));
  return bounds;
};

const loadAmap = (key: string): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.AMap) {
    return Promise.resolve();
  }
  if (window.__travelAgentAmapLoading) {
    return window.__travelAgentAmapLoading;
  }

  window.__travelAgentAmapLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("AMap script failed"));
    document.head.appendChild(script);
  });

  return window.__travelAgentAmapLoading;
};

const renderMarkerHTML = (item: MapPointState, annotations: MapAnnotationState[] = []) => {
  const isDimmed = item.status === "dimmed";
  const colors = pointVisualColors(item);
  const opacity = isDimmed ? 0.45 : 1;
  const metaLine = pointMetaLine(item);
  const annotationBadge =
    annotations.length > 0
      ? `<div style="position:absolute;left:17px;top:-8px;min-width:18px;height:18px;border-radius:999px;background:var(--app-warning-surface);color:var(--foreground);border:2px solid var(--app-surface-elevated);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">${annotations.length}</div>`
      : "";
  const order = item.point.visitOrder
    ? `#${item.point.visitOrder}`
    : item.point.dayIndex
      ? `D${item.point.dayIndex}`
      : "";
  return `<div title="${escapeHTML(item.popup?.title || item.point.label)}" style="opacity:${opacity};position:relative;cursor:pointer;">
      <div style="width:28px;height:28px;border-radius:999px;background:${colors.fill};border:3px solid var(--app-surface-elevated);box-shadow:0 0 0 4px ${colors.ring}55,0 8px 20px rgba(25,47,50,.22);"></div>
      ${annotationBadge}
      <div style="position:absolute;left:32px;top:1px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid var(--border);border-radius:999px;background:var(--app-pill-surface);padding:3px 7px;font-size:11px;font-weight:800;color:var(--foreground);box-shadow:0 8px 18px rgba(23,50,77,.12);">
        ${order ? `<span style="color:var(--primary);margin-right:4px;">${escapeHTML(order)}</span>` : ""}
        ${escapeHTML(item.point.label)}
      </div>
      ${metaLine ? `<div style="position:absolute;left:34px;top:24px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9px;font-weight:700;color:var(--muted-foreground);">${escapeHTML(metaLine)}</div>` : ""}
    </div>`;
};

const pointIntroText = (item: MapPointState) =>
  firstNonEmptyText(
    item.point.description,
    item.popup?.content,
    item.point.notes,
    item.reason,
    item.point.address,
  );

const pointIntroBlocks = (item: MapPointState) =>
  uniqueTextRows([
    { label: "景点介绍", value: item.point.description || "" },
    { label: "规划说明", value: item.popup?.content || "" },
    { label: "备注", value: item.point.notes || "" },
    { label: "选择原因", value: firstNonEmptyText(item.reason) },
  ]);

const pointAreaText = (item: MapPointState) =>
  [item.point.city, item.point.district]
    .filter((value, index, array) => value && array.indexOf(value) === index)
    .join(" ");

const pointScheduleText = (item: MapPointState) => {
  const parts = [
    item.point.visitOrder ? `第 ${item.point.visitOrder} 站` : "",
    item.point.startTime || item.point.endTime
      ? `${item.point.startTime || "待定"}-${item.point.endTime || "待定"}`
      : "",
    item.point.durationMin ? `停留约 ${item.point.durationMin} 分钟` : "",
  ].filter(Boolean);
  return parts.join(" · ");
};

const pointDetailRows = (item: MapPointState) =>
  uniqueTextRows([
    { label: "类型", value: firstNonEmptyText(item.point.category, item.point.kind) },
    { label: "区域", value: pointAreaText(item) },
    { label: "地址", value: item.point.address || "" },
    { label: "安排", value: pointScheduleText(item) },
    {
      label: "费用",
      value: item.point.estimatedCost ? `约 ${Math.round(item.point.estimatedCost)} 元` : "",
    },
    {
      label: "备注",
      value: item.point.notes && item.point.notes !== pointIntroText(item) ? item.point.notes : "",
    },
  ]);

const renderPointDetailRowsHTML = (rows: Array<{ label: string; value: string }>) => {
  if (rows.length === 0) {
    return "";
  }
  return `<div style="margin-top:8px;display:grid;gap:5px;font-size:11px;line-height:1.45;">
    ${rows
      .map(
        (row) =>
          `<div><span style="color:var(--primary);font-weight:700;">${escapeHTML(row.label)}：</span><span style="color:var(--muted-foreground);">${escapeHTMLWithBreaks(row.value)}</span></div>`,
      )
      .join("")}
  </div>`;
};

function renderPointIntroBlocksHTML(
  blocks: Array<{ label: string; value: string }>,
  limit = blocks.length,
) {
  const visibleBlocks = blocks.slice(0, limit);
  if (visibleBlocks.length === 0) {
    return "";
  }
  return `<div style="margin-top:8px;display:grid;gap:7px;font-size:11px;line-height:1.5;">
    ${visibleBlocks
      .map(
        (block) =>
          `<section><div style="color:var(--primary);font-weight:800;">${escapeHTML(block.label)}</div><div style="margin-top:2px;color:var(--muted-foreground);">${escapeHTMLWithBreaks(block.value)}</div></section>`,
      )
      .join("")}
  </div>`;
}

const renderLeafletMarkerHTML = (item: MapPointState, annotations: MapAnnotationState[] = []) => {
  const isDimmed = item.status === "dimmed";
  const colors = pointVisualColors(item);
  const badge =
    annotations.length > 0
      ? `<span style="position:absolute;right:-4px;top:-6px;min-width:18px;height:18px;border-radius:999px;background:var(--app-warning-surface);color:var(--foreground);border:2px solid var(--app-surface-elevated);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">${annotations.length}</span>`
      : "";

  return `<span style="position:relative;display:block;width:28px;height:28px;border-radius:999px;background:${colors.fill};border:3px solid var(--app-surface-elevated);box-shadow:0 0 0 4px ${colors.ring}55,0 8px 20px rgba(23,50,77,.24);opacity:${isDimmed ? 0.5 : 1};">${badge}</span>`;
};

const renderLeafletCalloutHTML = (item: MapPointState, annotations: MapAnnotationState[] = []) => {
  const title = item.popup?.title || item.point.label;
  const isDimmed = item.status === "dimmed";
  const metaLine = pointMetaLine(item);
  const order = item.point.visitOrder
    ? `#${item.point.visitOrder}`
    : item.point.dayIndex
      ? `D${item.point.dayIndex}`
      : "";

  return `<div title="${escapeHTML(title)}" style="max-width:160px;border:1px solid var(--border);border-radius:999px;background:var(--app-pill-surface);box-shadow:0 8px 18px rgba(23,50,77,.13);padding:4px 7px;color:var(--foreground);opacity:${isDimmed ? 0.62 : 0.94};cursor:pointer;">
      <div style="display:flex;align-items:center;gap:4px;min-width:0;font-size:11px;font-weight:800;line-height:1.25;">
        ${order ? `<span style="color:var(--primary);flex:0 0 auto;">${escapeHTML(order)}</span>` : ""}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(title)}</span>
        ${annotations.length > 0 ? `<span style="flex:0 0 auto;color:var(--primary);">+${annotations.length}</span>` : ""}
      </div>
      ${metaLine ? `<div style="margin-top:1px;font-size:9px;font-weight:700;line-height:1.2;color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(metaLine)}</div>` : ""}
    </div>`;
};

const renderLeafletPopupHTML = (item: MapPointState, annotations: MapAnnotationState[] = []) => {
  const title = item.popup?.title || item.point.label;
  const introBlocks = pointIntroBlocks(item);
  const metaLine = pointMetaLine(item);
  const detailRows = pointDetailRows(item);

  return renderMapPopupShellHTML(`<div>
      <div style="font-size:13px;font-weight:700;line-height:1.4;">${escapeHTML(title)}</div>
      ${metaLine ? `<div style="margin-top:4px;font-size:11px;color:var(--primary);">${escapeHTML(metaLine)}</div>` : ""}
      ${renderPointIntroBlocksHTML(introBlocks)}
      ${renderPointDetailRowsHTML(detailRows)}
      ${renderAnnotationBriefHTML(annotations, 8)}
    </div>`);
};

const renderAnnotationBriefHTML = (annotations: MapAnnotationState[] = [], limit = 3) => {
  if (annotations.length === 0) {
    return "";
  }
  const rows = annotations
    .slice(0, limit)
    .map((item) => {
      const annotation = item.annotation;
      const source =
        annotation.source === "zhihu" || annotation.kind === "zhihu_source"
          ? "知乎"
          : annotation.source === "review" || annotation.kind === "review"
            ? "审核"
            : annotation.kind === "decision"
              ? "权衡"
              : "思考";
      const summary = annotation.summary
        ? `<div style="margin-top:2px;color:var(--muted-foreground);">${escapeHTML(annotation.summary)}</div>`
        : "";
      return `<div style="margin-top:7px;border-top:1px solid var(--border);padding-top:6px;">
        <div style="font-size:11px;font-weight:700;color:var(--primary);">${source} · ${escapeHTML(annotation.title)}</div>
        ${summary}
      </div>`;
    })
    .join("");
  const more =
    annotations.length > limit
      ? `<div style="margin-top:6px;font-size:11px;color:var(--muted-foreground);">还有 ${annotations.length - limit} 条在证据面板中</div>`
      : "";
  return `<div style="margin-top:8px;font-size:11px;line-height:1.45;">${rows}${more}</div>`;
};
