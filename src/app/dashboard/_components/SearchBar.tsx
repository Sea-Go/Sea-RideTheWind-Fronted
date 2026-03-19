"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  placeholder: string;
  initialQuery?: string;
}

export const SearchBar = ({ placeholder, initialQuery = "" }: SearchBarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const submitSearch = () => {
    const trimmedQuery = query.trim();
    const currentQuery = searchParams.get("q")?.trim() ?? "";
    if (trimmedQuery === currentQuery) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (trimmedQuery) {
      nextParams.set("q", trimmedQuery);
    } else {
      nextParams.delete("q");
    }

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    submitSearch();
  };

  return (
    <div className="mt-6 mb-4 flex items-center gap-2">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-12 flex-1 rounded-full px-4"
      />
      <Button type="button" className="h-12 rounded-full px-5" onClick={submitSearch}>
        {"\u641c\u7d22"}
      </Button>
    </div>
  );
};
