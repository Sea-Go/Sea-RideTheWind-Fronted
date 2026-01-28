import { useState } from "react";

interface TabsProps {
  tabs: string[];
}

export const Tabs = ({ tabs }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="scrollbar-hide mb-6 flex space-x-2 overflow-x-auto pb-2">
      {tabs.map((tab, index) => (
        <button
          key={tab}
          onClick={() => setActiveTab(index)}
          className={`$ { activeTab === index ? "bg-red-500 text-white" : "text-gray-600 hover:text-gray-800" } rounded-full px-3 py-1 text-sm font-medium transition-colors`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};
