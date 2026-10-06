// 结构树侧栏当前传 mock 结构 JSON（DEMO_STRUCTURE_TREE）。
// 待后端端点 KNOWLEDGE_V2_PATHS.docStructure（后端未就绪，见 src/constants/api-paths.ts）：
// 就绪后改为按 id 拉取 DocStructureTreeUI，并支持 locator 命中高亮联动。
import { DEMO_STRUCTURE_TREE } from "@/features/knowledge/demo-fixtures";
import { KnowledgeReader } from "@/features/sea/pages/KnowledgePages";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SeaSearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  return (
    <SeaRoute searchParams={searchParams}>
      <KnowledgeReader
        id={id}
        releaseId={text(query.release)}
        revisionId={text(query.revision)}
        locator={text(query.locator)}
        structure={DEMO_STRUCTURE_TREE}
      />
    </SeaRoute>
  );
}
