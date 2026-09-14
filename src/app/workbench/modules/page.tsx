import { WorkbenchModules } from "@/features/knowledge/WorkbenchModules";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";
export default function Page({ searchParams }: { searchParams: SeaSearchParams }) {
  return (
    <SeaRoute searchParams={searchParams}>
      <WorkbenchModules />
    </SeaRoute>
  );
}
