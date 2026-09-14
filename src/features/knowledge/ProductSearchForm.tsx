"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Notice } from "@/features/sea/components/primitives";

import {
  clearSearchOperation,
  knowledgeProductSearch,
  loadSearchOperation,
  newSearchOperation,
  type ProductSearchInput,
  saveSearchOperation,
  SearchKeyConflict,
  type SearchOperation,
} from "./product-search";

const initialInput: ProductSearchInput = {
  module_id: "",
  query: "",
  depth: "fast",
  intelligence: "medium",
};

export function ProductSearchForm({
  sessionId,
  token,
  moduleId,
}: {
  sessionId: string;
  token: string;
  moduleId: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState<ProductSearchInput>({ ...initialInput, module_id: moduleId });
  const [operation, setOperation] = useState<SearchOperation | null>(null);
  const [phase, setPhase] = useState<"idle" | "sending" | "in_flight" | "retry" | "conflict">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(
    async (current: SearchOperation, mode: "post" | "get") => {
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      setPhase("sending");
      setMessage("");
      try {
        const response =
          mode === "post"
            ? await knowledgeProductSearch.create(sessionId, current, nextController.signal)
            : await knowledgeProductSearch.get(sessionId, current.searchId, nextController.signal);
        if (nextController.signal.aborted) return;
        if (current.searchId && current.searchId !== response.result.search_id)
          throw new Error("服务返回了另一个搜索操作；请核对当前会话。");
        const updated = { ...current, searchId: response.result.search_id };
        setOperation(updated);
        await saveSearchOperation(sessionId, token, updated);
        if (response.result.status === "succeeded" || response.result.status === "insufficient") {
          clearSearchOperation(sessionId);
          router.push(
            `/knowledge/answer-sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(response.result.answer_id)}`,
          );
        } else if (response.result.status === "in_flight") {
          setPhase("in_flight");
          setMessage("搜索仍在进行，正在回查固定操作。");
        } else {
          setPhase("retry");
          setMessage("搜索未被正式接纳。请使用原幂等键重试，或先回查固定操作。");
        }
      } catch (cause) {
        if (nextController.signal.aborted) return;
        setPhase(cause instanceof SearchKeyConflict ? "conflict" : "retry");
        setMessage(cause instanceof Error ? cause.message : "搜索暂不可用，请用原请求重试。");
      }
    },
    [router, sessionId, token],
  );

  useEffect(() => {
    let active = true;
    loadSearchOperation(sessionId, token).then((saved) => {
      if (!active || !saved) return;
      setInput(saved.input);
      setOperation(saved);
      if (saved.searchId) void run(saved, "get");
      else {
        setPhase("retry");
        setMessage("上次请求的响应未返回。继续使用原幂等键，不会创建另一条搜索。");
      }
    });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [run, sessionId, token]);

  useEffect(() => {
    if (phase !== "in_flight" || !operation?.searchId) return;
    const timer = window.setTimeout(() => void run(operation, "get"), 3000);
    return () => window.clearTimeout(timer);
  }, [operation, phase, run]);

  const start = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operation) return;
    try {
      const current = newSearchOperation(input);
      setOperation(current);
      await saveSearchOperation(sessionId, token, current);
      await run(current, "post");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "无法建立搜索请求。");
    }
  };

  return (
    <section className="knowledge-search" aria-label="搜索知识模块">
      <div className="knowledge-search-heading">
        <div>
          <span className="sea-eyebrow">SEARCH THE LIBRARY</span>
          <h2>向知识库提问</h2>
          <p>搜索结果会在 RTW 正式接纳后进入本会话的答案历史。</p>
        </div>
      </div>
      <form onSubmit={start}>
        <div className="knowledge-search-row">
          <label>
            知识模块 ID
            <input
              value={input.module_id}
              onChange={(event) => setInput({ ...input, module_id: event.target.value })}
              disabled={Boolean(operation)}
              required
              maxLength={200}
              autoComplete="off"
            />
          </label>
          <label>
            搜索深度
            <select
              value={input.depth}
              onChange={(event) =>
                setInput({ ...input, depth: event.target.value as ProductSearchInput["depth"] })
              }
              disabled={Boolean(operation)}
            >
              <option value="fast">快搜</option>
              <option value="detailed">详搜</option>
            </select>
          </label>
          <label>
            智能层级
            <select
              value={input.intelligence}
              onChange={(event) =>
                setInput({
                  ...input,
                  intelligence: event.target.value as ProductSearchInput["intelligence"],
                })
              }
              disabled={Boolean(operation)}
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>
        </div>
        <label>
          你的问题
          <textarea
            value={input.query}
            onChange={(event) => setInput({ ...input, query: event.target.value })}
            disabled={Boolean(operation)}
            required
            maxLength={4096}
            rows={3}
          />
        </label>
        {!operation && (
          <button className="sea-button" type="submit">
            开始搜索
          </button>
        )}
      </form>
      {operation && (
        <div className="knowledge-search-operation">
          <p role="status">{phase === "sending" ? "正在提交或回查搜索…" : message}</p>
          {operation.searchId && <small>固定搜索操作：{operation.searchId}</small>}
          {phase === "retry" && (
            <div className="knowledge-search-actions">
              <button className="sea-button" onClick={() => void run(operation, "post")}>
                用原请求重试
              </button>
              {operation.searchId && (
                <button onClick={() => void run(operation, "get")}>回查固定操作</button>
              )}
            </div>
          )}
          {phase === "conflict" && (
            <button
              onClick={() => {
                clearSearchOperation(sessionId);
                setOperation(null);
                setPhase("idle");
              }}
            >
              新建一次搜索
            </button>
          )}
        </div>
      )}
      {!operation && message && <Notice error>{message}</Notice>}
    </section>
  );
}
