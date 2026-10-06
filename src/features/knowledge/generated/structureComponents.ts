// 知识 v2 结构树 / 引用定位 / 证据包 / Lint 待办 组件类型（引用轨 FE-2026-10-06）。
//
// 轨道说明：F1（chat 流式）轨与本轨各自独立创建同名文件，内容对齐
// Sea-Docs《LLM-Wiki平台工程目录与工作规范》§2.4 的同名类型草案；
// 合并时二取其一，不视为冲突。后端 RTW generated/typesscript 下发后，
// 本文件由 scripts/sync-knowledge-contract.cjs 从权威生成物刷新替换。
// 端点登记见 src/constants/api-paths.ts 的 KNOWLEDGE_V2_PATHS（后端未就绪）。

/** 引用定位：quote 高亮以 anchor.go 校验通过的字位区间为准。 */
export interface StructureLocator {
  doc_key: string;
  revision_id: string;
  /** 章节面包屑，自文档根到引用所在章节。 */
  section_path: string[];
  /** 段落序号，文档内从 1 起。 */
  para_index: number;
  /** 以下为 anchor.go 校验通过的字符区间（含起、不含止）。 */
  char_start: number;
  char_end: number;
}

/** 检索 lane 分数：dense/sparse/multi 三段必填，rerank 可选第四段。 */
export interface EvidenceLaneScores {
  dense: number;
  sparse: number;
  multi: number;
  rerank?: number;
}

export type EvidenceLane = "dense" | "sparse" | "multi";

/** 单条证据：定位 + 原文摘录 + lane 分数（可解释性折叠区数据源）。 */
export interface EvidenceItem {
  locator: StructureLocator;
  quote: string;
  lanes: EvidenceLaneScores;
}

/** EvidencePack 候选：一个 doc 聚合 RRF 融合分与主 lane。 */
export interface EvidencePackCandidate {
  doc_key: string;
  title: string;
  revision_id: string;
  /** RRF 融合分，等宽数字右对齐展示。 */
  rrf_score: number;
  /** 主导 lane，用于三色徽章。 */
  top_lane: EvidenceLane;
  evidence: EvidenceItem[];
}

export interface EvidencePack {
  search_id: string;
  candidates: EvidencePackCandidate[];
}

/** 结构树标题节点：可折叠/展开；level 1..6 对应 16px/级缩进。 */
export interface DocStructureHeading {
  kind: "heading";
  level: number;
  title: string;
  /** 稳定锚点 id，用于命中高亮与锚点跳转。 */
  anchor: string;
  children: DocStructureNode[];
}

/** 结构树段落节点：doc 级，不渲染 chunk，仅显示首行截断。 */
export interface DocStructureParagraph {
  kind: "paragraph";
  para_index: number;
  first_line: string;
}

export type DocStructureNode = DocStructureHeading | DocStructureParagraph;

export interface DocStructureTree {
  doc_key: string;
  title: string;
  revision_id: string;
  nodes: DocStructureNode[];
}

/** Lint 待办类型（C-15 消费）：矛盾 / 孤页 / 缺引用 / 过时。 */
export type KnowledgeLintKind = "conflict" | "orphan" | "missing-citation" | "stale";

export interface KnowledgeLintTodo {
  id: string;
  kind: KnowledgeLintKind;
  summary: string;
  /** 涉及页 doc key，链接到 /knowledge/{page_key}/read。 */
  page_key: string;
  page_title: string;
  /** RFC3339 检出时间。 */
  detected_at: string;
}
