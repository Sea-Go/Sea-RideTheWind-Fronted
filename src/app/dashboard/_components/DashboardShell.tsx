import { type ReactNode, Suspense } from "react";

import { DASHBOARD_TABS } from "@/app/dashboard/_constants/tabs";
import { RecoPrewarm } from "@/components/common/RecoPrewarm";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import type { DashboardSearchMode } from "@/types";

import { SearchBar } from "./SearchBar";
import { Tabs } from "./Tabs";

interface DashboardShellProps {
  children: ReactNode;
  query?: string;
  mode?: DashboardSearchMode;
}

export const DashboardShell = ({ children, query, mode }: DashboardShellProps) => (
  <Layout>
    <PageContainer className="py-5 sm:py-7">
      <Suspense fallback={null}>
        <SearchBar
          placeholder={"\u641c\u7d22\u6216\u8f93\u5165\u4efb\u4f55\u95ee\u9898"}
          initialQuery={query}
          initialMode={mode}
        />
      </Suspense>
      <Tabs tabs={DASHBOARD_TABS} />
      {children}
      <RecoPrewarm />
    </PageContainer>
  </Layout>
);
