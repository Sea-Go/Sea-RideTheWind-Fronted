"use client";
import { type MouseEvent, useState } from "react";

import type {
  DocStructureHeading,
  DocStructureNode,
  DocStructureParagraph,
  DocStructureTreeUI,
} from "./generated/structureComponents";

import "./knowledge.css";

/** 深度缩进：16px/级。 */
const INDENT_PER_LEVEL = 16;

function isHit(node: DocStructureNode, active: { anchor?: string; paraIndex?: number }): boolean {
  if (node.kind === "heading") return Boolean(active.anchor) && node.anchor === active.anchor;
  return typeof active.paraIndex === "number" && node.para_index === active.paraIndex;
}

function TreeRow({
  node,
  depth,
  active,
  collapsed,
  toggle,
  onLocate,
}: {
  node: DocStructureNode;
  depth: number;
  active: { anchor?: string; paraIndex?: number };
  collapsed: boolean;
  toggle: (anchor: string) => void;
  onLocate?: (node: DocStructureParagraph) => void;
}) {
  const hit = isHit(node, active);
  const indent = { paddingLeft: `${depth * INDENT_PER_LEVEL}px` };

  if (node.kind === "heading") {
    const heading = node as DocStructureHeading;
    const childCount = heading.children.length;
    return (
      <button
        type="button"
        className={`stree-row stree-heading ${hit ? "hit" : ""} ${collapsed ? "collapsed" : ""}`}
        style={indent}
        aria-expanded={!collapsed}
        title={`${heading.title}（${childCount} 个子节点）`}
        onClick={() => toggle(heading.anchor)}
      >
        <span className="stree-caret" aria-hidden="true">
          {collapsed ? "▸" : "▾"}
        </span>
        <span className="stree-heading-title">{heading.title}</span>
        <span className="stree-count">{childCount}</span>
      </button>
    );
  }

  const paragraph = node as DocStructureParagraph;
  const interactive = Boolean(onLocate);
  const locate = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onLocate?.(paragraph);
  };
  return (
    <div
      className={`stree-row stree-paragraph ${hit ? "hit" : ""}`}
      style={indent}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onClick: locate,
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onLocate?.(paragraph);
              }
            },
          }
        : {})}
      title={paragraph.first_line}
    >
      <span className="stree-para-mark" aria-hidden="true">
        ¶
      </span>
      <span className="stree-para-index">P{paragraph.para_index}</span>
      <span className="stree-para-line">{paragraph.first_line}</span>
    </div>
  );
}

function TreeLevel({
  nodes,
  depth,
  active,
  collapsedAnchors,
  toggle,
  onLocate,
}: {
  nodes: DocStructureNode[];
  depth: number;
  active: { anchor?: string; paraIndex?: number };
  collapsedAnchors: string[];
  toggle: (anchor: string) => void;
  onLocate?: (node: DocStructureParagraph) => void;
}) {
  return (
    <ul className="stree-level">
      {nodes.map((node) => {
        if (node.kind === "heading") {
          const heading = node as DocStructureHeading;
          const collapsed = collapsedAnchors.includes(heading.anchor);
          return (
            <li key={heading.anchor}>
              <TreeRow
                node={node}
                depth={depth}
                active={active}
                collapsed={collapsed}
                toggle={toggle}
                onLocate={onLocate}
              />
              {heading.children.length > 0 && (
                <div className={`stree-children ${collapsed ? "" : "open"}`}>
                  <div className="stree-children-inner">
                    <TreeLevel
                      nodes={heading.children}
                      depth={depth + 1}
                      active={active}
                      collapsedAnchors={collapsedAnchors}
                      toggle={toggle}
                      onLocate={onLocate}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        }
        return (
          <li key={`p-${node.para_index}`}>
            <TreeRow
              node={node}
              depth={depth}
              active={active}
              collapsed={false}
              toggle={toggle}
              onLocate={onLocate}
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 结构树浏览：doc 级渲染（不渲染 chunk）。标题节点可折叠/展开（150ms），
 * 段落节点显示首行截断；当前命中以 accent 左边条高亮；长列表容器滚动。
 */
export function StructureTreeViewer({
  tree,
  activeAnchor,
  activeParaIndex,
  onLocate,
  heading = "结构树",
  note,
}: {
  tree: DocStructureTreeUI;
  /** 当前命中的标题锚点。 */
  activeAnchor?: string;
  /** 当前命中的段落序号。 */
  activeParaIndex?: number;
  onLocate?: (node: DocStructureParagraph) => void;
  heading?: string;
  /** 数据来源说明（如“演示数据 · 端点未就绪”）。 */
  note?: string;
}) {
  const [collapsedAnchors, setCollapsedAnchors] = useState<string[]>([]);
  const toggle = (anchor: string) =>
    setCollapsedAnchors((keys) =>
      keys.includes(anchor) ? keys.filter((item) => item !== anchor) : [...keys, anchor],
    );
  const active = { anchor: activeAnchor, paraIndex: activeParaIndex };

  return (
    <nav className="stree" aria-label={heading}>
      <div className="stree-head">
        <span className="stree-title">{heading}</span>
        <span className="stree-doc" title={`${tree.doc_key} · ${tree.revision_id}`}>
          {tree.title}
        </span>
      </div>
      {note && <p className="stree-note">{note}</p>}
      <div className="stree-scroll" role="group" aria-label={`${tree.title} 的文档结构`}>
        <TreeLevel
          nodes={tree.nodes}
          depth={0}
          active={active}
          collapsedAnchors={collapsedAnchors}
          toggle={toggle}
          onLocate={onLocate}
        />
      </div>
    </nav>
  );
}
