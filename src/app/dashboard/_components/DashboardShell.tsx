import type { ReactNode } from "react";

import { DASHBOARD_TABS } from "@/app/dashboard/_constants/tabs";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";

import { SearchBar } from "./SearchBar";
import { Tabs } from "./Tabs";

interface DashboardShellProps {
  children: ReactNode;
}

export const DashboardShell = ({ children }: DashboardShellProps) => (
  <Layout>
    <PageContainer className="py-4">
      <SearchBar placeholder="搜索或输入任何问题" />
      <Tabs tabs={DASHBOARD_TABS} />
      {children}
    </PageContainer>
  </Layout>
);
