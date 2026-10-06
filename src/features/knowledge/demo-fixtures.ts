// 演示 fixtures：结构树与 Lint 待办的占位数据。
// 待后端端点（src/constants/api-paths.ts 的 KNOWLEDGE_V2_PATHS，后端未就绪）：
// 就绪后由页面改为从端点读取 DocStructureTree / KnowledgeLintTodo[]，
// 本文件即删除。当前仅用于验收 StructureTreeViewer / LintTodoList 的渲染与视觉令牌。

import type { DocStructureTree, KnowledgeLintTodo } from "./generated/structureComponents";

export const DEMO_STRUCTURE_TREE: DocStructureTree = {
  doc_key: "mountain-wiki",
  title: "山地如何塑造气候与生命",
  revision_id: "wiki-r4",
  nodes: [
    {
      kind: "heading",
      level: 1,
      title: "山地如何塑造气候与生命",
      anchor: "section-0",
      children: [
        {
          kind: "paragraph",
          para_index: 1,
          first_line: "从一朵云的形成，到一整片森林的分布……",
        },
        {
          kind: "paragraph",
          para_index: 2,
          first_line: "让我们沿着山的高度，读懂地形、气候与生命之间的联系。",
        },
        {
          kind: "heading",
          level: 2,
          title: "01 / 一座山，改变一场雨",
          anchor: "section-1",
          children: [
            {
              kind: "paragraph",
              para_index: 3,
              first_line: "湿润的空气遇到山体被迫抬升，冷却凝结成云……",
            },
            {
              kind: "paragraph",
              para_index: 4,
              first_line: "迎风坡降水与背风坡干燥，常在同一座山上同时出现。",
            },
          ],
        },
        {
          kind: "heading",
          level: 2,
          title: "02 / 翻过山脊，走进另一种气候",
          anchor: "section-2",
          children: [
            {
              kind: "paragraph",
              para_index: 5,
              first_line: "雨影效应让山脊两侧拥有截然不同的植被与农业。",
            },
            {
              kind: "paragraph",
              para_index: 6,
              first_line: "观察同一海拔两侧的差异，比记住单一结论更有价值。",
            },
          ],
        },
        {
          kind: "heading",
          level: 2,
          title: "03 / 高度之外，还要看见坡向",
          anchor: "section-3",
          children: [
            {
              kind: "paragraph",
              para_index: 7,
              first_line: "温度随海拔上升而降低，但植物还需要水与阳光。",
            },
          ],
        },
        {
          kind: "heading",
          level: 2,
          title: "04 / 引用与资料",
          anchor: "section-4",
          children: [
            {
              kind: "paragraph",
              para_index: 8,
              first_line: "本页每一处结论都绑定固定修订与段落定位。",
            },
          ],
        },
      ],
    },
  ],
};

export const DEMO_LINT_TODOS: KnowledgeLintTodo[] = [
  {
    id: "lint-001",
    kind: "conflict",
    summary: "「迎风坡降水」与「山地观察笔记 r2 第 3 章」对年降水量的表述相互矛盾。",
    page_key: "mountain",
    page_title: "山地如何塑造气候与生命",
    detected_at: "2026-10-06T09:12:00+08:00",
  },
  {
    id: "lint-002",
    kind: "missing-citation",
    summary: "「雨影效应」一节的结论段缺少资料引用，无法回溯到固定修订。",
    page_key: "mountain",
    page_title: "山地如何塑造气候与生命",
    detected_at: "2026-10-06T09:13:20+08:00",
  },
  {
    id: "lint-003",
    kind: "orphan",
    summary: "「冰川留下的时间刻度」未被任何知识页或目录引用，成为孤页。",
    page_key: "glacier-time",
    page_title: "冰川留下的时间刻度",
    detected_at: "2026-10-05T16:40:00+08:00",
  },
  {
    id: "lint-004",
    kind: "stale",
    summary: "「垂直自然带」引用的资料修订 r1 已被 r2 取代，内容可能过时。",
    page_key: "vertical-zones",
    page_title: "从河谷到雪线：垂直自然带",
    detected_at: "2026-10-04T11:05:00+08:00",
  },
];
