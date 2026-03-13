// 首页欢迎页，使用统一布局与页面容器样式。
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Home() {
  return (
    <Layout>
      <PageContainer className="flex min-h-[calc(100vh-9rem)] flex-col justify-center py-16">
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">欢迎来到内容创作中心</p>
          <h1 className="text-4xl font-bold tracking-tight">欢迎使用 Sea-TryGo</h1>
          <p className="text-muted-foreground text-sm">在这里发布、管理并探索你的内容灵感。</p>
        </div>
      </PageContainer>
    </Layout>
  );
}
