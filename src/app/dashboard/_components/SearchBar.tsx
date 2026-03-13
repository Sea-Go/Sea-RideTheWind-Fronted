"use client";

// Dashboard 搜索栏，使用 shadcn Input 统一风格。
import { useState } from "react";

import { Input } from "@/components/ui/input";

interface SearchBarProps {
  placeholder: string;
}

export const SearchBar = ({ placeholder }: SearchBarProps) => {
  const [query, setQuery] = useState("");

  return (
    <div className="relative mt-6 mb-4">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full px-4"
      />
      {/* 搜索图标可选，若无图片可移除 */}
      {/* <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
        <Image src="/assets/images/etiwh.jpg" alt="Search" width={20} height={20} />
      </button> */}
    </div>
  );
};
