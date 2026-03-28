"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, useEffect, useState } from "react";

import {
  DASHBOARD_SEARCH_MODE_OPTIONS,
  DEFAULT_DASHBOARD_SEARCH_MODE,
  normalizeDashboardSearchMode,
} from "@/app/dashboard/_constants/search-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardSearchMode } from "@/types";

interface SearchBarProps {
  placeholder: string;
  initialQuery?: string;
  initialMode?: DashboardSearchMode;
}

export const SearchBar = ({
  placeholder,
  initialQuery = "",
  initialMode = DEFAULT_DASHBOARD_SEARCH_MODE,
}: SearchBarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<DashboardSearchMode>(initialMode);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const submitSearch = () => {
    const trimmedQuery = query.trim();
    const currentQuery = searchParams.get("q")?.trim() ?? "";
    const currentMode = normalizeDashboardSearchMode(searchParams.get("mode"));
    if (trimmedQuery === currentQuery && mode === currentMode) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (trimmedQuery) {
      nextParams.set("q", trimmedQuery);
    } else {
      nextParams.delete("q");
    }

    if (mode === DEFAULT_DASHBOARD_SEARCH_MODE) {
      nextParams.delete("mode");
    } else {
      nextParams.set("mode", mode);
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
    <div className="mt-6 mb-4 flex flex-col gap-3 md:flex-row md:items-center">
      <Select value={mode} onValueChange={(value) => setMode(value as DashboardSearchMode)}>
        <SelectTrigger className="h-12 w-full rounded-full px-4 md:w-52">
          <SelectValue placeholder="选择搜索模式" />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_SEARCH_MODE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex w-full items-center gap-2">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-12 flex-1 rounded-full px-4"
        />
        <Button type="button" className="h-12 rounded-full px-5" onClick={submitSearch}>
          搜索
        </Button>
      </div>
    </div>
  );
};
