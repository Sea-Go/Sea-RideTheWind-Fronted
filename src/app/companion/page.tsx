import { CompanionPage } from "@/features/sea/pages/CommunityExtras";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  return (
    <SeaRoute searchParams={searchParams}>
      <CompanionPage />
    </SeaRoute>
  );
}
