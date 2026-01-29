import { useState } from "react";

interface SearchBarProps {
  placeholder: string;
}

export const SearchBar = ({ placeholder }: SearchBarProps) => {
  const [query, setQuery] = useState("");

  return (
    <div className="relative mt-6 mb-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500 focus:outline-none"
      />
      {/* 搜索图标可选，若无图片可移除 */}
      {/* <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
        <Image src="/assets/images/etiwh.jpg" alt="Search" width={20} height={20} />
      </button> */}
    </div>
  );
};
