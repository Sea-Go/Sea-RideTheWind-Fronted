// 搜索栏

// src/components/common/SearchBar.tsx
import { useState } from "react";

export default function SearchBar() {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("搜索:", query);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索或输入任何问题"
          className="w-full max-w-2xl rounded-full border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="absolute top-1/2 right-2 -translate-y-1/2 transform text-gray-500"
        >
          🔍
        </button>
      </div>
    </form>
  );
}
