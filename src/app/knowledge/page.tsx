import { KnowledgeShelf } from "@/features/sea/pages/KnowledgePages";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  return (
    <SeaRoute searchParams={searchParams}>
      <KnowledgeShelf />
    </SeaRoute>
  );
}
