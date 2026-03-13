// 站点页脚，提供统一的版权与底部样式。
import { PageContainer } from "./PageContainer";

export const Footer = () => {
  return (
    <footer className="border-border bg-background mt-12 border-t py-6">
      <PageContainer className="text-muted-foreground text-center text-sm">
        © 2025 Sea TryGo. All rights reserved.
      </PageContainer>
    </footer>
  );
};
