import { CommunityPage } from "@/features/sea/pages/CommunityPage";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  return (
    <SeaRoute searchParams={searchParams}>
      <CommunityPage />
    </SeaRoute>
  );
}
