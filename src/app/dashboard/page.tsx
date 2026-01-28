"use client";

import { CardList } from "@/components/common/CardList";
import { SearchBar } from "@/components/common/SearchBar";
import { Tabs } from "@/components/common/Tabs";
import { Layout } from "@/components/layout/layout";

export default function Dashboard() {
  return (
    <Layout>
      <div className="mx-auto max-w-7xl p-4">
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
      </div>
    </Layout>
  );
}
