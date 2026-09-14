"use client";
import { useEffect, useState } from "react";

import { MarkdownArticle } from "@/components/article/MarkdownArticle";
import { EmptyState, Notice, SeaLink } from "@/features/sea/components/primitives";

import { knowledge, knowledgeRead, type Module, type Release, type Revision } from "./api";
import { revisionHref, sourceParagraph } from "./state";

import "./knowledge.css";

type PublishedSnapshot = { module: Module; release: Release; revisions: Revision[]; next?: string };
export function PublishedModule({ moduleId }: { moduleId: string }) {
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    Promise.all([knowledge.module(moduleId, c.signal), knowledge.published(moduleId, c.signal)])
      .then(async ([module, release]) => {
        const list = await knowledgeRead.publishedRevisions(
          moduleId,
          release.release_id,
          "",
          c.signal,
        );
        if (!c.signal.aborted)
          setSnapshot({ module, release, revisions: list.items, next: list.next_cursor });
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [moduleId]);
  async function more() {
    if (!snapshot?.next || loading) return;
    setLoading(true);
    try {
      const page = await knowledgeRead.publishedRevisions(
        moduleId,
        snapshot.release.release_id,
        snapshot.next,
      );
      setSnapshot(
        (s) => s && { ...s, revisions: [...s.revisions, ...page.items], next: page.next_cursor },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }
  if (!snapshot)
    return (
      <div className="sea-content">
        <SeaLink href="/knowledge">← 返回书架</SeaLink>
        <EmptyState title={loading ? "正在读取正式版本" : "模块暂不可用"}>
          {error || "只读取已正式发布的知识。"}
        </EmptyState>
      </div>
    );
  return (
    <div className="sea-content">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">知识书架</SeaLink>
        <span>/</span>
        {snapshot.module.title}
      </div>
      <section className="sea-module-hero">
        <img src="/sea/book-orbits.svg" width="420" height="290" alt="知识轨道插画" />
        <div>
          <span className="sea-eyebrow">{snapshot.module.category} · LIVING KNOWLEDGE</span>
          <h1>{snapshot.module.title}</h1>
          <p>{snapshot.module.description}</p>
          <span className="sea-pill">v{snapshot.release.ordinal} · 正式版本</span>
          <p>
            {snapshot.release.source_revision_ids.length} 份原文修订 ·{" "}
            {snapshot.release.wiki_revision_ids.length} 个 Wiki 页
          </p>
          <p className="knowledge-id">{snapshot.release.release_id}</p>
        </div>
      </section>
      {error && <Notice error>{error}</Notice>}
      <div className="sea-two-col">
        {[
          { kind: "wiki", label: "维护过的知识页" },
          { kind: "source", label: "保留来处的原始资料" },
        ].map((group) => (
          <section key={group.kind}>
            <h2>{group.label}</h2>
            {snapshot.revisions
              .filter((r) => r.kind === group.kind)
              .map((r) => (
                <SeaLink
                  key={r.revision_id}
                  href={revisionHref(moduleId, snapshot.release.release_id, r)}
                  className="sea-chapter"
                >
                  <div>
                    <h3>{r.title}</h3>
                    <p className="knowledge-id">{r.revision_id}</p>
                    <small>{r.provenance || `${r.source_refs?.length || 0} 处来源定位`}</small>
                  </div>
                  <span>→</span>
                </SeaLink>
              ))}
          </section>
        ))}
      </div>
      {snapshot.next && (
        <button className="sea-button" disabled={loading} onClick={() => void more()}>
          加载更多目录
        </button>
      )}
      <div className="sea-info-band">
        <p>每次阅读绑定具体发布版本和修订。后续发布与回滚不会静默改写历史引用。</p>
        <SeaLink href={`/knowledge/${encodeURIComponent(moduleId)}/workbench`}>
          维护此模块 →
        </SeaLink>
      </div>
    </div>
  );
}
export function PublishedReader({
  moduleId,
  releaseId = "",
  revisionId = "",
  locator = "",
  source = false,
}: {
  moduleId: string;
  releaseId?: string;
  revisionId?: string;
  locator?: string;
  source?: boolean;
}) {
  const [release, setRelease] = useState<Release | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    (async () => {
      if (revisionId && !releaseId)
        throw new Error("历史修订阅读需要同时指定发布版本，不能套用当前活动版本。");
      const r = releaseId
        ? await knowledgeRead.publishedRelease(moduleId, releaseId, c.signal)
        : await knowledge.published(moduleId, c.signal);
      const id = revisionId || (source ? r.source_revision_ids[0] : r.wiki_revision_ids[0]);
      if (!id) throw new Error(source ? "此正式版本没有原始资料。" : "此正式版本没有 Wiki 页面。");
      const body = await knowledgeRead.publishedRevision(moduleId, r.release_id, id, c.signal);
      if (typeof body.content !== "string" || !body.content.trim())
        throw new Error("服务未返回完整修订正文。");
      if (body.kind !== (source ? "source" : "wiki"))
        throw new Error("所选修订类型与阅读入口不符。");
      if (!c.signal.aborted) {
        setRelease(r);
        setRevision(body);
      }
    })()
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [moduleId, releaseId, revisionId, source]);
  if (error || !release || !revision)
    return (
      <div className="sea-content">
        <SeaLink href={`/knowledge/${encodeURIComponent(moduleId)}`}>← 返回模块</SeaLink>
        <EmptyState title={loading ? "正在读取固定修订" : "此修订暂不可读"}>
          {error || "核对发布版本、修订成员关系及正文。"}
        </EmptyState>
      </div>
    );
  const paragraph = sourceParagraph(revision.content || "", locator);
  return (
    <div className="sea-content">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">知识</SeaLink>
        <span>/</span>
        <SeaLink href={`/knowledge/${encodeURIComponent(moduleId)}`}>当前正式版目录</SeaLink>
        <span>/</span>v{release.ordinal} 固定修订
      </div>
      <div className="sea-reader-grid">
        <aside className="sea-reader-nav">
          <span className="sea-eyebrow">{source ? "SOURCE" : "WIKI"}</span>
          <h2>{revision.title}</h2>
          <span className="sea-pill">v{release.ordinal} · 曾正式发布</span>
          <p className="knowledge-id">发布：{release.release_id}</p>
          <p className="knowledge-id">修订：{revision.revision_id}</p>
          <p>{revision.provenance}</p>
          <SeaLink href={revisionHref(moduleId, release.release_id, revision)}>
            此修订固定链接 →
          </SeaLink>
        </aside>
        <article className="sea-reading">
          <div className="sea-eyebrow">{source ? "原始资料" : "持续维护的知识"}</div>
          <h1>{revision.title}</h1>
          {locator &&
            (paragraph === null ? (
              <Notice error>未找到引用定位 {locator}。完整正文仍按固定修订显示。</Notice>
            ) : (
              <section className="sea-evidence" id="source-location">
                <div>
                  <strong>引用定位 · {locator}</strong>
                  <blockquote>{paragraph}</blockquote>
                </div>
              </section>
            ))}
          <MarkdownArticle value={revision.content || ""} />
          <h2>版本与来源</h2>
          <p className="knowledge-id">内容校验：{revision.content_hash}</p>
          {revision.source_refs?.map((ref) => (
            <SeaLink
              key={`${ref.revision_id}:${ref.locator}`}
              href={revisionHref(
                moduleId,
                release.release_id,
                { revision_id: ref.revision_id, kind: "source" },
                ref.locator,
              )}
              className="sea-source-link"
            >
              <span>
                原文修订 · {ref.locator}
                <small className="knowledge-id">{ref.revision_id}</small>
              </span>
              <span>阅读出处 →</span>
            </SeaLink>
          ))}
        </article>
      </div>
    </div>
  );
}
