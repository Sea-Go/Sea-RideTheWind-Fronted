"use client";
import { type KeyboardEvent, type MouseEvent, useState } from "react";

import type { EvidenceItem, StructureLocator } from "./generated/structureComponents";

import "./knowledge.css";

/** lane 分数低于该阈值视为低相关：显示告警条，不隐藏内容。 */
export const LOW_RELEVANCE_LANE_THRESHOLD = 0.35;

const LANE_SEGMENTS: Array<{ key: "dense" | "sparse" | "multi"; label: string }> = [
  { key: "dense", label: "稠密" },
  { key: "sparse", label: "稀疏" },
  { key: "multi", label: "多跳" },
];

function lanePercent(score: number): string {
  const clamped = Math.min(1, Math.max(0, score));
  return `${Math.round(clamped * 100)}%`;
}

export function CitationCard({
  docKey,
  title,
  revisionId,
  item,
  compact = false,
  onOpen,
}: {
  docKey: string;
  title: string;
  revisionId: string;
  item: EvidenceItem;
  /** 紧凑态：证据面板等密集列表复用，压缩内距并截断 quote。 */
  compact?: boolean;
  /** 提供后整卡可点击/回车打开固定来源。 */
  onOpen?: (docKey: string, locator: StructureLocator) => void;
}) {
  const [lanesOpen, setLanesOpen] = useState(false);
  const { locator, quote, lanes } = item;
  const laneValues = [lanes.dense, lanes.sparse, lanes.multi];
  const lowRelevance = laneValues.every((score) => score < LOW_RELEVANCE_LANE_THRESHOLD);
  const interactive = Boolean(onOpen);
  const classes = [
    "citation-card",
    compact ? "compact" : "",
    interactive ? "clickable" : "",
    lowRelevance ? "low-relevance" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const open = () => onOpen?.(docKey, locator);
  const stopAnd = (action: () => void) => (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    action();
  };

  return (
    <article
      className={classes}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onClick: open,
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
              // 内部按钮（如“检索分数”）的 Enter/Space 冒泡到此：不触发整卡打开。
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
              }
            },
            "aria-label": `打开引用来源：${title}，段落 ${locator.para_index}`,
          }
        : {})}
    >
      <header className="citation-card-head">
        <strong className="citation-card-title">{title}</strong>
        <span className="citation-card-revision" title={`文档 ${docKey} · 修订 ${revisionId}`}>
          {revisionId}
        </span>
      </header>
      <p className="citation-card-path">
        {locator.section_path.length > 0 ? (
          locator.section_path.map((section, index) => (
            <span className="citation-card-crumb" key={`${index}:${section}`}>
              {index > 0 && (
                <i className="citation-card-sep" aria-hidden="true">
                  ›
                </i>
              )}
              {section}
            </span>
          ))
        ) : (
          <span className="citation-card-crumb">（无章节路径）</span>
        )}
        <sup
          className="citation-card-para"
          title={`字符区间 ${locator.char_start}–${locator.char_end}`}
        >
          #P{locator.para_index}
        </sup>
      </p>
      <blockquote className="citation-card-quote">{quote}</blockquote>
      <button
        type="button"
        className="citation-card-lanes-toggle"
        aria-expanded={lanesOpen}
        onClick={stopAnd(() => setLanesOpen((value) => !value))}
      >
        检索分数
        <span className="citation-card-caret" aria-hidden="true">
          {lanesOpen ? "▴" : "▾"}
        </span>
      </button>
      {lanesOpen && (
        <dl className="citation-card-lanes">
          {LANE_SEGMENTS.map(({ key, label }) => (
            <div className="citation-lane" key={key}>
              <dt>{label}</dt>
              <dd>
                <span
                  className="citation-lane-track"
                  title={`${label}分数 ${lanes[key].toFixed(2)}`}
                >
                  <span
                    className={`citation-lane-fill lane-${key}`}
                    style={{ width: lanePercent(lanes[key]) }}
                  />
                </span>
                <span className="citation-lane-value">{lanes[key].toFixed(2)}</span>
              </dd>
            </div>
          ))}
          {typeof lanes.rerank === "number" && (
            <div className="citation-lane">
              <dt>重排</dt>
              <dd>
                <span className="citation-lane-track" title={`重排分数 ${lanes.rerank.toFixed(2)}`}>
                  <span
                    className="citation-lane-fill lane-rerank"
                    style={{ width: lanePercent(lanes.rerank) }}
                  />
                </span>
                <span className="citation-lane-value">{lanes.rerank.toFixed(2)}</span>
              </dd>
            </div>
          )}
        </dl>
      )}
      {lowRelevance && (
        <p className="citation-card-warning" role="status">
          {`低相关证据：三个检索 lane 的分数都低于 ${LOW_RELEVANCE_LANE_THRESHOLD}。内容仍完整展示，请人工核实后再采纳。`}
        </p>
      )}
    </article>
  );
}
