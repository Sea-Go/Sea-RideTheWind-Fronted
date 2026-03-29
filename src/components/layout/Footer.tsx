import { PageContainer } from "./PageContainer";

export const Footer = () => {
  return (
    <footer className="border-border bg-background mt-10 border-t py-5 sm:py-6">
      <PageContainer className="text-muted-foreground flex flex-col gap-2 text-center text-xs sm:text-sm">
        <p>© 2025 识海社区。保留所有权利。</p>
        <p className="text-[11px] sm:text-xs">让推荐、创作与交流，在不同设备上都保持顺手。</p>
      </PageContainer>
    </footer>
  );
};
