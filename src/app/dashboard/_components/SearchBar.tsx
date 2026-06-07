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
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
      <Select value={mode} onValueChange={(value) => setMode(value as DashboardSearchMode)}>
        <SelectTrigger className="border-border/85 bg-card/78 text-muted-foreground h-11 w-full rounded-full px-5 shadow-sm sm:h-12 lg:w-56">
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

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="border-border/85 bg-card/78 h-11 flex-1 rounded-full px-5 shadow-sm sm:h-12"
        />
        <Button
          type="button"
          className="h-11 w-full rounded-full px-6 shadow-lg shadow-primary/20 sm:h-12 sm:w-auto"
          onClick={submitSearch}
        >
          搜索
        </Button>
      </div>
    </div>
  );
};
