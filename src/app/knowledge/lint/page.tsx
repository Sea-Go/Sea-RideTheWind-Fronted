import { DEMO_LINT_TODOS } from "@/features/knowledge/demo-fixtures";
import { LintTodoList } from "@/features/knowledge/LintTodoList";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";

// Lint 待办页骨架（C-15 消费）。数据为占位 fixtures：
// 待后端端点 KNOWLEDGE_V2_PATHS.lintTodos（后端未就绪，见 src/constants/api-paths.ts）。
export default async function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  await searchParams;
  return (
    <SeaRoute searchParams={searchParams}>
      <LintTodoList items={DEMO_LINT_TODOS} />
    </SeaRoute>
  );
}
