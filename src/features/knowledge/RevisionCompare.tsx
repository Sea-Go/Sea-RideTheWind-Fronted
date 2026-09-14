"use client";
import { useEffect, useState } from "react";

import { Notice } from "@/features/sea/components/primitives";

import { knowledgeRead, type Revision } from "./api";

export function RevisionCompare({
  moduleId,
  revisions,
}: {
  moduleId: string;
  revisions: Revision[];
}) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  return (
    <section>
      <h2>比较固定修订</h2>
      <p>两侧读取独立修订正文。选择旧版与新版核对变化，活动版本切换不会替换这里的文本。</p>
      <div className="sea-two-col">
        {[
          { id: left, select: setLeft, label: "基准修订" },
          { id: right, select: setRight, label: "候选修订" },
        ].map((side) => (
          <label className="sea-field" key={side.label}>
            {side.label}
            <select
              aria-label={side.label}
              value={side.id}
              onChange={(e) => side.select(e.target.value)}
            >
              <option value="">选择具体修订</option>
              {revisions.map((r) => (
                <option key={r.revision_id} value={r.revision_id} disabled={r.withdrawn}>
                  {r.kind} · {r.title} · {r.revision_id}
                  {r.withdrawn ? "（已撤回）" : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="sea-diff">
        <RevisionSide
          key={`left:${left}:${revisions.find((r) => r.revision_id === left)?.withdrawn}`}
          moduleId={moduleId}
          revisionId={left}
        />
        <RevisionSide
          key={`right:${right}:${revisions.find((r) => r.revision_id === right)?.withdrawn}`}
          moduleId={moduleId}
          revisionId={right}
        />
      </div>
    </section>
  );
}
function RevisionSide({ moduleId, revisionId }: { moduleId: string; revisionId: string }) {
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!revisionId) return;
    const controller = new AbortController();
    knowledgeRead
      .revision(moduleId, revisionId, controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) {
          if (typeof r.content !== "string" || !r.content.trim())
            throw new Error("服务未返回修订正文，无法比较。");
          setRevision(r);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [moduleId, revisionId]);
  return (
    <div>
      {!revisionId ? (
        <p>请选择修订。</p>
      ) : error ? (
        <Notice error>{error}</Notice>
      ) : revision ? (
        <>
          <h3>{revision.title}</h3>
          <p className="knowledge-id">
            {revision.revision_id} · {revision.content_hash}
          </p>
          <pre className="knowledge-body">{revision.content}</pre>
          <small>
            {revision.source_refs?.map((r) => `${r.revision_id} · ${r.locator}`).join("；")}
          </small>
        </>
      ) : (
        <p role="status">正在读取固定正文…</p>
      )}
    </div>
  );
}
