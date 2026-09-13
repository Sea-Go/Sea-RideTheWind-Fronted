import { KnowledgeReader } from "@/features/sea/pages/KnowledgePages";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SeaSearchParams;
}) {
  const { id } = await params;
  return (
    <SeaRoute searchParams={searchParams}>
      <KnowledgeReader id={id} source />
    </SeaRoute>
  );
}
