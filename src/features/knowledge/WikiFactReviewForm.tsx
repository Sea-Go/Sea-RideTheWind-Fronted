"use client";
import { useState } from "react";

import type { WikiReviewEvidence } from "./WikiReviewEvidence";

export type FactAssessment = "covered" | "missing" | "conflict" | "undetermined";
export type WikiFactReviewDraft = {
  evidence: WikiReviewEvidence;
  assessment: FactAssessment;
  grade: string;
  reason: string;
};

const assessmentNames: Record<FactAssessment, string> = {
  covered: "已覆盖",
  missing: "缺失",
  conflict: "冲突",
  undetermined: "无法判定",
};
const grades: Record<FactAssessment, { value: string; label: string }[]> = {
  covered: [
    { value: "1", label: "1 · 涉及事实，引用或表述仍含糊" },
    { value: "2", label: "2 · 来源忠实、引用正确，仍缺少必要上下文" },
    { value: "3", label: "3 · 来源忠实、完整清晰" },
  ],
  missing: [{ value: "0", label: "0 · 缺失" }],
  conflict: [{ value: "0", label: "0 · 与原文冲突" }],
  undetermined: [{ value: "", label: "不打数字分" }],
};

export function WikiFactReviewForm({
  evidence,
  busy,
  onSubmit,
}: {
  evidence: WikiReviewEvidence | null;
  busy: boolean;
  onSubmit: (draft: WikiFactReviewDraft) => void;
}) {
  const [assessment, setAssessment] = useState<FactAssessment>("missing");
  const [grade, setGrade] = useState("0");
  const [reason, setReason] = useState("");
  const citationPresent = Boolean(
    evidence?.wiki.source_refs?.some(
      (ref) => ref.revision_id === evidence.source.revision_id && ref.locator === evidence.locator,
    ),
  );
  const claim = evidence?.wikiClaim || "";
  const withdrawn = Boolean(evidence?.wiki.withdrawn || evidence?.source.withdrawn);
  const consistent =
    (!withdrawn || assessment === "undetermined") &&
    ((assessment === "covered" && Boolean(claim) && ["1", "2", "3"].includes(grade)) ||
      (assessment === "conflict" && Boolean(claim) && grade === "0") ||
      (assessment === "missing" && !claim && grade === "0") ||
      (assessment === "undetermined" && grade === ""));
  const citedForStrongGrade = !["2", "3"].includes(grade) || citationPresent;
  const ready = Boolean(
    evidence &&
    reason.trim() &&
    new TextEncoder().encode(reason).length <= 2000 &&
    consistent &&
    citedForStrongGrade,
  );

  return (
    <form
      className="wiki-review-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (evidence && ready && !busy) onSubmit({ evidence, assessment, grade, reason });
      }}
    >
      <h2>人工事实判断</h2>
      <p>0–3 表示这条原文事实在选定 Wiki 修订中的覆盖与引用质量，由维护者判断。</p>
      {!evidence ? (
        <p>先在左侧选定固定原文片段和 Wiki 修订。</p>
      ) : (
        <>
          <p className="knowledge-id">
            目标 Wiki {evidence.wiki.revision_id} · 原文 {evidence.source.revision_id} ·{" "}
            {evidence.locator}
          </p>
          <blockquote className="knowledge-body">{evidence.sourceQuote}</blockquote>
          {claim && <blockquote className="knowledge-body">Wiki：{claim}</blockquote>}
          {withdrawn && <p>原文或 Wiki 修订已撤回，新的复核只能记录“无法判定”。</p>}
          <label className="sea-field">
            判断
            <select
              value={assessment}
              onChange={(event) => {
                const next = event.target.value as FactAssessment;
                setAssessment(next);
                setGrade(grades[next][0].value);
              }}
            >
              {Object.entries(assessmentNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="sea-field">
            覆盖级别
            <select value={grade} onChange={(event) => setGrade(event.target.value)}>
              {grades[assessment].map((option) => (
                <option key={option.value || "undetermined"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {!consistent && (
            <p role="alert">该判断与固定 Wiki 断言不匹配；缺失需留空，已覆盖或冲突需逐字断言。</p>
          )}
          {!citedForStrongGrade && <p role="alert">2–3 分要求 Wiki 精确引用这份原文修订与段落。</p>}
          <label className="sea-field">
            判断理由
            <textarea
              required
              rows={4}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="说明核对结果；无法判定时写明原因"
            />
          </label>
          <button className="sea-button primary" disabled={!ready || busy}>
            {busy ? "正在记录…" : "记录这条事实判断"}
          </button>
        </>
      )}
    </form>
  );
}
