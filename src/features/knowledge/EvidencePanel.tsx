"use client";
import { useState } from "react";

import { CitationCard } from "./CitationCard";
import type {
  EvidenceLane,
  EvidencePack,
  EvidencePackCandidate,
  StructureLocator,
} from "./generated/structureComponents";

import "./knowledge.css";

const LANE_BADGE_LABELS: Record<EvidenceLane, string> = {
  dense: "稠密",
  sparse: "稀疏",
  multi: "多跳",
};

function CandidateRow({
  candidate,
  expanded,
  onToggle,
  onOpen,
}: {
  candidate: EvidencePackCandidate;
  expanded: boolean;
  onToggle: () => void;
  onOpen?: (docKey: string, locator: StructureLocator) => void;
}) {
  return (
    <li className="evidence-candidate">
      <button
        type="button"
        className="evidence-row"
        aria-expanded={expanded}
        aria-label={`${expanded ? "收起" : "展开"}候选 ${candidate.title} 的证据列表`}
        onClick={onToggle}
      >
        <span className="evidence-row-title">{candidate.title}</span>
        <span className={`lane-badge ${candidate.top_lane}`}>
          {LANE_BADGE_LABELS[candidate.top_lane]}
        </span>
        <span className="evidence-row-score" title="RRF 融合分">
          {candidate.rrf_score.toFixed(4)}
        </span>
        <span className="evidence-row-caret" aria-hidden="true">
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      <div className={`evidence-candidate-items ${expanded ? "open" : ""}`}>
        <div className="evidence-candidate-items-inner">
          {candidate.evidence.map((item) => (
            <CitationCard
              key={`${item.locator.para_index}:${item.locator.char_start}`}
              docKey={candidate.doc_key}
              title={candidate.title}
              revisionId={candidate.revision_id}
              item={item}
              compact
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </li>
  );
}

/**
 * EvidencePack 候选列表：每候选一行（标题 + RRF 分数等宽右对齐 + lane 徽章），
 * 展开显示其 evidence Locator 列表（复用 CitationCard 紧凑态）。
 */
export function EvidencePanel({
  pack,
  onOpen,
  heading = "证据候选",
  emptyText = "暂无证据候选：本次检索没有可展示的 EvidencePack。",
}: {
  pack: EvidencePack | null;
  onOpen?: (docKey: string, locator: StructureLocator) => void;
  heading?: string;
  emptyText?: string;
}) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const candidates = pack?.candidates ?? [];
  const toggle = (key: string) =>
    setOpenKeys((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key],
    );

  return (
    <section className="evidence-panel" aria-label={heading}>
      <h3 className="evidence-panel-title">{heading}</h3>
      {pack && pack.search_id ? (
        <p className="evidence-panel-meta">search_id：{pack.search_id}</p>
      ) : null}
      {candidates.length === 0 ? (
        <p className="evidence-panel-empty">{emptyText}</p>
      ) : (
        <ul className="evidence-panel-list">
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.doc_key}
              candidate={candidate}
              expanded={openKeys.includes(candidate.doc_key)}
              onToggle={() => toggle(candidate.doc_key)}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
