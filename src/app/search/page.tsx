import { SearchPage } from "@/features/sea/pages/SearchPage";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default async function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  const q = await searchParams;
  return (
    <SeaRoute searchParams={searchParams}>
      <SearchPage initialQuery={typeof q.q === "string" ? q.q : undefined} />
    </SeaRoute>
  );
}
