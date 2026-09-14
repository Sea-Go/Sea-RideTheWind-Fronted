import { AnswerHistoryEntry } from "@/features/knowledge/AnswerHistory";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";

export default async function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  const params = await searchParams;
  const moduleId = typeof params.module_id === "string" ? params.module_id : "";
  return (
    <SeaRoute searchParams={searchParams}>
      <AnswerHistoryEntry moduleId={moduleId} />
    </SeaRoute>
  );
}
