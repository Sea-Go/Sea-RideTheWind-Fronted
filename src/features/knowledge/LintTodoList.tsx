"use client";
import { EmptyState, Notice, SeaLink } from "@/features/sea/components/primitives";

import type { KnowledgeLintKind, KnowledgeLintTodo } from "./generated/structureComponents";

import "./knowledge.css";

const LINT_BADGES: Record<KnowledgeLintKind, string> = {
  conflict: "矛盾",
  orphan: "孤页",
  "missing-citation": "缺引用",
  stale: "过时",
};

/**
 * Lint 待办列表（C-15 消费骨架）：类型徽章 + 涉及页链接 + 处置按钮占位。
 * 处置动作等待后端端点（见 api-paths.ts KNOWLEDGE_V2_PATHS.lintTodos，后端未就绪）。
 */
export function LintTodoList({ items }: { items: KnowledgeLintTodo[] }) {
  return (
    <div className="sea-content lint-todo-page">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">知识书架</SeaLink>
        <span>/</span>
        <span>Lint 待办</span>
      </div>
      <div className="sea-page-heading compact">
        <div>
          <span className="sea-eyebrow">KNOWLEDGE LINT</span>
          <h1>知识质量待办</h1>
          <p>
            汇总矛盾、孤页、缺引用与过时四类待办，逐条人工裁决。当前为前端骨架：
            列表数据与处置端点均等待后端就绪（KNOWLEDGE_V2_PATHS.lintTodos）。
          </p>
        </div>
      </div>
      <Notice>
        后端 Lint 端点未就绪：以下为占位演示数据，仅验收列表结构与视觉令牌，不代表真实质量结论。
      </Notice>
      {items.length === 0 ? (
        <EmptyState title="暂无 Lint 待办">
          当前发布版本没有检出矛盾、孤页、缺引用或过时问题。
        </EmptyState>
      ) : (
        <ul className="lint-list">
          {items.map((item) => (
            <li className="lint-item" key={item.id}>
              <span className={`lint-badge ${item.kind}`}>{LINT_BADGES[item.kind]}</span>
              <div className="lint-item-body">
                <strong>{item.summary}</strong>
                <small>
                  检出时间 {item.detected_at} · 待办 {item.id}
                </small>
                <SeaLink
                  href={`/knowledge/${encodeURIComponent(item.page_key)}/read`}
                  className="sea-text-link"
                >
                  涉及页：{item.page_title} →
                </SeaLink>
              </div>
              <button
                type="button"
                className="sea-button lint-dispose"
                disabled
                title="处置端点后端未就绪，暂为占位按钮"
              >
                处置（占位）
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
