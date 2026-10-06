"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CHAT_API_PATHS } from "@/constants/api-paths";
import { getAuthToken } from "@/services/auth";

import { type ChatTier, isChatTier } from "./generated/structureComponents";

/**
 * 学习问答流式客户端（契约与 /api/v1/chat 对齐，SSE）：
 *
 * 请求：POST /api/chat（Next BFF 透传 A1）
 *   { tier, question, session_id, after?: { message_id, seq } }
 *
 * SSE 事件：
 *   event: message  data: { id, role, part: { type: "text", text }, seq? }
 *   event: done     data: {}
 *   event: error    data: { message }
 *
 * message.part.text 为增量 append；seq 为同一条消息内的单调递增序号。
 * 断线重连时客户端带 after 游标重发，服务端可从游标续发；无论服务端
 * 是否重放，客户端都按 (message id, seq) 幂等去重，不重复渲染已显段落
 * （规范 §2.4 前端条款 4：SSE 断线重连不重复渲染已显段落）。
 */

export interface ChatStreamTextPart {
  type: "text";
  text: string;
}

export type ChatStreamPart = ChatStreamTextPart;

export interface ChatStreamMessage {
  id: string;
  role: "user" | "assistant";
  parts: ChatStreamPart[];
}

export type ChatStreamStatus = "idle" | "streaming" | "reconnecting" | "error";

export interface ChatSendPayload {
  question: string;
  tier: ChatTier;
}

interface ChatStreamEvent {
  id?: unknown;
  role?: unknown;
  part?: unknown;
  seq?: unknown;
}

interface StreamCursor {
  messageId: string;
  seq: number;
}

const RECONNECT_BASE_DELAY_MS = 600;
const RECONNECT_MAX_ATTEMPTS = 3;

/** 消息内已应用的最大引用角标编号（升序去重），供侧栏占位消费。 */
export const collectCitationNumbers = (messages: ChatStreamMessage[]): number[] => {
  const seen = new Set<number>();
  for (const message of messages) {
    for (const part of message.parts) {
      for (const match of part.text.matchAll(/\[(\d+)\]/g)) {
        const n = Number.parseInt(match[1] as string, 10);
        if (Number.isFinite(n) && n > 0) seen.add(n);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/** 把一帧原始 SSE 文本解析为 { event, data }；无 data 行时返回 null。 */
export const parseSSEFrame = (frame: string): { event: string; data: unknown } | null => {
  let event = "message";
  let dataText: string | null = null;
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) event = line.slice(6).trim() || "message";
    else if (line.startsWith("data:")) dataText = line.slice(5).trim();
  }
  if (dataText === null) return null;
  try {
    return { event, data: JSON.parse(dataText) as unknown };
  } catch {
    return { event, data: dataText };
  }
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStream = (options: { onFatal?: (message: string) => void } = {}) => {
  const [messages, setMessages] = useState<ChatStreamMessage[]>([]);
  const [status, setStatus] = useState<ChatStreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [streamTier, setStreamTier] = useState<ChatTier | null>(null);
  const sessionIdRef = useRef<string>(makeId("session"));
  const controllerRef = useRef<AbortController | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<StreamCursor | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const appendMessage = useCallback((message: ChatStreamMessage) => {
    setMessages((current) => [...current, message]);
  }, []);

  /**
   * 幂等追加增量：仅在 seq 可用时按 (message id, seq) 去重后 append。
   * 当上游缺失 seq 时，不再退化为按 text 去重，避免合法重复片段被误丢弃。
   */
  const applyStreamEvent = useCallback((payload: ChatStreamEvent): boolean => {
    const id = textOf(payload.id);
    const part = asRecord(payload.part);
    const text = part !== null && part.type === "text" ? textOf(part.text) : "";
    if (!id || !text) return false;
    const seq =
      typeof payload.seq === "number" && Number.isFinite(payload.seq) ? payload.seq : null;
    const dedupeKey = seq === null ? null : `${id}\u0000${seq}`;
    if (dedupeKey !== null && seenRef.current.has(dedupeKey)) return false;
    if (dedupeKey !== null) seenRef.current.add(dedupeKey);
    if (seq !== null && (!cursorRef.current || seq > cursorRef.current.seq)) {
      cursorRef.current = { messageId: id, seq };
    }
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === id);
      if (index === -1) {
        const role = payload.role === "user" ? "user" : "assistant";
        return [...current, { id, role, parts: [{ type: "text", text }] }];
      }
      const target = current[index];
      if (!target) return current;
      const next = current.slice();
      next[index] = { ...target, parts: [...target.parts, { type: "text", text }] };
      return next;
    });
    return true;
  }, []);

  const readStream = useCallback(
    async (response: Response): Promise<"done" | "network"> => {
      if (!response.body) return "network";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return "done";
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
            const parsed = parseSSEFrame(frame);
            if (!parsed) continue;
            if (parsed.event === "message") {
              applyStreamEvent(asRecord(parsed.data) ?? {});
            } else if (parsed.event === "error") {
              const data = asRecord(parsed.data);
              throw new Error(textOf(data?.message) || "上游流式返回错误");
            } else if (parsed.event === "done") {
              return "done";
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    [applyStreamEvent],
  );

  const requestStream = useCallback(
    async (payload: ChatSendPayload, signal: AbortSignal): Promise<"done" | "network"> => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(CHAT_API_PATHS.chat, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tier: payload.tier,
          question: payload.question,
          session_id: sessionIdRef.current,
          after: cursorRef.current,
        }),
        signal,
        cache: "no-store",
      });
      if (!response.ok) {
        let msg = `问答服务暂时不可用（${response.status}）`;
        try {
          const envelope = asRecord(await response.json());
          if (typeof envelope?.msg === "string" && envelope.msg) msg = envelope.msg;
        } catch {
          /* 保留默认提示 */
        }
        throw new Error(msg);
      }
      return readStream(response);
    },
    [readStream],
  );

  const send = useCallback(
    async (payload: ChatSendPayload) => {
      const question = payload.question.trim();
      if (!question || !isChatTier(payload.tier)) return;
      if (status === "streaming" || status === "reconnecting") return;
      setError(null);
      setStreamTier(payload.tier);
      seenRef.current = new Set();
      cursorRef.current = null;
      appendMessage({
        id: makeId("user"),
        role: "user",
        parts: [{ type: "text", text: question }],
      });
      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus("streaming");
      let attempt = 0;
      for (;;) {
        try {
          const outcome = await requestStream(payload, controller.signal);
          if (!mountedRef.current) return;
          setStatus("idle");
          return;
        } catch (e) {
          if (!mountedRef.current || controller.signal.aborted) {
            if (mountedRef.current) setStatus("idle");
            return;
          }
          const isNetwork = e instanceof TypeError;
          if (!isNetwork) {
            const message = e instanceof Error ? e.message : "问答服务暂时不可用";
            setError(message);
            setStatus("error");
            options.onFatal?.(message);
            return;
          }
          attempt += 1;
          if (attempt > RECONNECT_MAX_ATTEMPTS) {
            const message = "连接中断，已自动重试仍未恢复";
            setError(message);
            setStatus("error");
            options.onFatal?.(message);
            return;
          }
          setStatus("reconnecting");
          await wait(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1));
          if (!mountedRef.current || controller.signal.aborted) {
            if (mountedRef.current) setStatus("idle");
            return;
          }
          setStatus("streaming");
        }
      }
    },
    [appendMessage, options, requestStream, status],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    seenRef.current = new Set();
    cursorRef.current = null;
    sessionIdRef.current = makeId("session");
    setMessages([]);
    setError(null);
    setStatus("idle");
  }, []);

  return { messages, status, error, streamTier, send, stop, reset };
};
