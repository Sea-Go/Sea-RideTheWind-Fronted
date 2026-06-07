import { PageContainer } from "./PageContainer";

export const Footer = () => {
  return (
    <footer
      className="border-border/70 bg-card/70 mt-8 border-t py-5 backdrop-blur sm:py-6"
      style={{ background: "var(--app-footer-background)" }}
    >
      <PageContainer className="text-muted-foreground flex flex-col text-center text-xs sm:text-sm">
        <p>© 2025 识海社区。保留所有权利。</p>
      </PageContainer>
    </footer>
  );
};
