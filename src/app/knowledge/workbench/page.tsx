import { KnowledgeWorkbench } from "@/features/sea/pages/KnowledgePages";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default async function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  const query = await searchParams;
  const moduleId = typeof query.module_id === "string" ? query.module_id : undefined;
  return (
    <SeaRoute searchParams={searchParams}>
      <KnowledgeWorkbench key={moduleId ?? "unselected"} moduleId={moduleId} />
    </SeaRoute>
  );
}
