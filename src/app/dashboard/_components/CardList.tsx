"use client";

import { useEffect, useState } from "react";

import type { DashboardPost } from "@/types";

import { Card } from "./Card";

interface PostsResponse {
  success: boolean;
  posts: DashboardPost[];
}

export const CardList = () => {
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/posts", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Fetch posts failed");
        }

        const data: PostsResponse = await response.json();
        setPosts(data.posts ?? []);
      } catch (error) {
        console.error(error);
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPosts();
  }, []);

  if (isLoading) {
    return <p className="text-muted-foreground py-8 text-center">文章加载中...</p>;
  }

  if (!posts.length) {
    return <p className="text-muted-foreground py-8 text-center">暂无文章，快去发布第一篇吧。</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {posts.map((post) => (
        <Card key={post.id} {...post} />
      ))}
    </div>
  );
};
