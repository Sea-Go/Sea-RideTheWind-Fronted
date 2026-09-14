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
      />
    </SeaRoute>
  );
}
