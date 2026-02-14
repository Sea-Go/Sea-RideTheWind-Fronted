"use client";

import { CardList } from "@/app/dashboard/_components/CardList";
import { SearchBar } from "@/app/dashboard/_components/SearchBar";
import { Tabs } from "@/app/dashboard/_components/Tabs";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Dashboard() {
  return (
    <Layout>
      <PageContainer className="py-4">
        <SearchBar placeholder="搜索或输入任何问题" />
        <Tabs
          tabs={[
            "推荐",
            "穿搭",
            "美食",
            "彩妆",
            "影视",
            "职场",
            "情感",
            "家居",
            "游戏",
            "旅行",
            "健身",
          ]}
        />
        <CardList />
      </PageContainer>
    </Layout>
  );
}
