import { HotRankingBoard } from "@/components/hot/HotRankingBoard";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";

export default function HotPage() {
  return (
    <Layout>
      <PageContainer>
        <HotRankingBoard />
      </PageContainer>
    </Layout>
  );
}
