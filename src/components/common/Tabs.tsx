// 分类标签

// src/components/common/Tabs.tsx
import { useState } from "react";

const tabs = [
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
];

export default function Tabs() {
  const [activeTab, setActiveTab] = useState("推荐");

  return (
    <div className="mb-6 overflow-x-auto whitespace-nowrap">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`$ { activeTab === tab ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200" } mx-1 rounded-md px-4 py-2 transition`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
