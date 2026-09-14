"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EmptyState, Notice, SeaLink } from "@/features/sea/components/primitives";
import { useSea } from "@/features/sea/components/SeaShell";

import { knowledge, type Module } from "./api";
import { CommandKeys } from "./state";

export function WorkbenchModules() {
  const router = useRouter();
  const { href } = useSea();
  const [items, setItems] = useState<Module[]>([]);
  const [cursor, setCursor] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const keys = useRef(new CommandKeys());
  useEffect(() => {
    const controller = new AbortController();
    knowledge
      .modules(cursor, controller.signal, true)
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.items || []);
          setNext(result.next_cursor || "");
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cursor, revision]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setError("");
    const input = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
    };
    try {
      const result = await knowledge.createModule({
        ...input,
        idempotency_key: keys.current.key("module", input),
      });
      keys.current.complete("module", input);
      router.push(href(`/knowledge/${encodeURIComponent(result.id)}/workbench`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败；输入已保留。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sea-content">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">已发布书架</SeaLink>
        <span>/</span>知识工作台
      </div>
      <div className="sea-page-heading compact">
        <div>
          <span className="sea-eyebrow">KNOWLEDGE STUDIO</span>
          <h1>从第一份资料，开始维护知识。</h1>
          <p>这里管理草稿与候选版本。只有手动发布后的模块才会出现在公开书架。</p>
        </div>
      </div>
      {error && (
        <Notice error>
          {error} <SeaLink href="/login">登录具有维护权限的账号</SeaLink>
        </Notice>
      )}
      <div className="sea-two-col">
        <section>
          <div className="sea-panel-head">
            <h2>维护中的模块</h2>
            <button
              className="sea-button"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setRevision((v) => v + 1);
              }}
            >
              刷新
            </button>
          </div>
          {loading && <p role="status">正在读取工作台…</p>}
          {items.map((item) => (
            <SeaLink
              key={item.id}
              href={`/knowledge/${encodeURIComponent(item.id)}/workbench`}
              className="sea-chapter"
            >
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>
                  {item.active_release_id ? `已发布 ${item.release}` : "尚未发布"} · {item.sources}{" "}
                  份资料 · {item.pages} 个知识页
                </small>
              </div>
            </SeaLink>
          ))}
          {!loading && !items.length && !error && (
            <EmptyState title="还没有知识模块">在右侧建立主题，再加入原始资料与 Wiki。</EmptyState>
          )}
          <div className="sea-actions">
            {cursor && (
              <button
                className="sea-button"
                onClick={() => {
                  setLoading(true);
                  setCursor("");
                }}
              >
                返回第一页
              </button>
            )}
            {next && (
              <button
                className="sea-button"
                onClick={() => {
                  setLoading(true);
                  setCursor(next);
                }}
              >
                下一页
              </button>
            )}
          </div>
        </section>
        <form onSubmit={create} className="sea-note-card">
          <h2>新建知识模块</h2>
          <label className="sea-field">
            模块标题
            <input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="sea-field">
            主题分类
            <input value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="sea-field">
            模块说明
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button className="sea-button primary" disabled={busy || !title.trim()}>
            {busy ? "正在创建…" : "创建草稿模块"}
          </button>
        </form>
      </div>
    </div>
  );
}
