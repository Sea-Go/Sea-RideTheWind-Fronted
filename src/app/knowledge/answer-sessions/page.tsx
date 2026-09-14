import { AnswerHistoryEntry } from "@/features/knowledge/AnswerHistory";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";

export default function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  return (
    <SeaRoute searchParams={searchParams}>
      <AnswerHistoryEntry />
    </SeaRoute>
  );
}
