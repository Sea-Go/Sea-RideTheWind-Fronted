import { LearnPage } from "@/features/sea/pages/LearnPage";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  return (
    <SeaRoute searchParams={searchParams}>
      <LearnPage />
    </SeaRoute>
  );
}
