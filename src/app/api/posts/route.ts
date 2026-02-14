import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

interface DashboardPost {
  id: string;
  title: string;
  image: string | null;
  author: string;
  likes: number;
  content: string;
  publishedAt: string;
}

const cleanMarkdown = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/^#+\s*/gm, "")
    .replace(/[>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseMarkdownFile = (fileName: string, raw: string): DashboardPost | null => {
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n\n?/);
  const frontmatterText = frontmatterMatch?.[1] ?? "";
  const contentText = frontmatterMatch ? raw.slice(frontmatterMatch[0].length) : raw;

  const coverMatch = frontmatterText.match(/(?:^|\n)cover:\s*"([^"]+)"/);
  const titleMatch = frontmatterText.match(/(?:^|\n)title:\s*"([^"]+)"/);
  const publishedAtMatch = frontmatterText.match(/(?:^|\n)publishedAt:\s*"([^"]+)"/);

  const cleanedContent = cleanMarkdown(contentText);
  if (!cleanedContent) {
    return null;
  }

  const firstSentence = cleanedContent.split(/[。.!?！？]/)[0]?.trim();
  const fallbackTitle = firstSentence ? firstSentence.slice(0, 28) : fileName;
  const title = titleMatch?.[1]?.trim() || fallbackTitle;

  return {
    id: fileName,
    title: title || fileName,
    image: coverMatch?.[1] ?? null,
    author: "匿名用户",
    likes: 0,
    content: cleanedContent.slice(0, 90),
    publishedAt: publishedAtMatch?.[1] ?? "",
  };
};

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), "public");
    const files = await fs.readdir(publicDir);

    const markdownFiles = files.filter((name) => /^\d{14}\.md$/.test(name));

    const posts = await Promise.all(
      markdownFiles.map(async (fileName) => {
        const filePath = path.join(publicDir, fileName);
        const raw = await fs.readFile(filePath, "utf-8");
        return parseMarkdownFile(fileName, raw);
      }),
    );

    const sortedPosts = posts
      .filter((item): item is DashboardPost => Boolean(item))
      .sort((a, b) => {
        const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return timeB - timeA;
      });

    return NextResponse.json({ success: true, posts: sortedPosts });
  } catch (error) {
    console.error("Failed to read posts:", error);
    return NextResponse.json({ success: false, error: "Failed to read posts" }, { status: 500 });
  }
}
