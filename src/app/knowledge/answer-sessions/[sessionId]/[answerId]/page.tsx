import { AnswerHistory } from "@/features/knowledge/AnswerHistory";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string; answerId: string }>;
  searchParams: SeaSearchParams;
}) {
  const { sessionId, answerId } = await params;
  return (
    <SeaRoute searchParams={searchParams}>
      <AnswerHistory key={`${sessionId}/${answerId}`} sessionId={sessionId} answerId={answerId} />
    </SeaRoute>
  );
}
