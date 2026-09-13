import { DemoArticle } from "@/features/sea/pages/CommunityExtras";
import { SeaRoute, type SeaSearchParams } from "@/features/sea/route-context";

import LegacyArticlePage from "./LegacyArticlePage";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SeaSearchParams;
}) {
  const { id } = await params;
  const q = await searchParams;
  if (id.startsWith("demo-") && q.demo === "1" && process.env.SEA_ENABLE_DEMO === "1")
    return (
      <SeaRoute searchParams={searchParams}>
        <DemoArticle id={id} />
      </SeaRoute>
    );
  return <LegacyArticlePage />;
}
