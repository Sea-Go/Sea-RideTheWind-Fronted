import { AnswerHistory } from "@/features/knowledge/AnswerHistory";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: SeaSearchParams;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const moduleId = typeof query.module_id === "string" ? query.module_id : "";
  return (
    <SeaRoute searchParams={searchParams}>
      <AnswerHistory key={sessionId} sessionId={sessionId} moduleId={moduleId} />
    </SeaRoute>
  );
}
