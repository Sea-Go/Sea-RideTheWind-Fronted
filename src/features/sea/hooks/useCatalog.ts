"use client";
import { useEffect, useRef, useState } from "react";

import { useSea } from "../components/SeaShell";
import { communityPage } from "../data/api";
import { stories } from "../data/demo";
import type { Story } from "../data/types";
export function useCommunity() {
  const { demo, ready } = useSea();
  const [items, setItems] = useState<Story[]>(demo ? stories.slice(0, 3) : []);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [revision, setRevision] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (!ready || demo) return;
    const id = ++seq.current;
    const c = new AbortController();
    communityPage(page, c.signal)
      .then((r) => {
        if (id !== seq.current) return;
        setItems(r.items);
        setHasMore(r.hasMore);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : "社区暂不可用");
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
    return () => c.abort();
  }, [demo, ready, page, revision]);
  return {
    items: demo ? (page === 1 ? stories.slice(0, 3) : stories.slice(3)) : items,
    loading: demo ? false : loading,
    error,
    hasMore: demo ? page === 1 : hasMore,
    page,
    next: () => {
      setLoading(!demo);
      setError("");
      setPage((p) => p + 1);
    },
    previous: () => {
      setLoading(!demo);
      setError("");
      setPage((p) => Math.max(1, p - 1));
    },
    refresh: () => {
      setLoading(!demo);
      setError("");
      setRevision((r) => r + 1);
    },
  };
}
