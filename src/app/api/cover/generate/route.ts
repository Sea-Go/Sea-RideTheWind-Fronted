import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

const cleanMarkdown = (content: string) =>
  content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildCoverPrompt = (content: string) => {
  const summary = cleanMarkdown(content).slice(0, 180) || "tech community article";
  return `Create a modern, minimal, text-free cover illustration for a web community post. Topic: ${summary}. Style: clean, flat, soft gradient, no human face, no watermark, no text, 16:9.`;
};

export async function POST(request: Request) {
  try {
    const { content } = await request.json();

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "Article content is required" },
        { status: 400 },
      );
    }

    const prompt = buildCoverPrompt(content);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true`;
    const imageResponse = await fetch(imageUrl, {
      cache: "no-store",
    });

    if (!imageResponse.ok) {
      throw new Error(`AI image generation failed: ${imageResponse.status}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const now = new Date();
    const fileName = `cover-ai-${now.getTime()}.png`;
    const coverDir = path.join(process.cwd(), "public", "covers");
    const filePath = path.join(coverDir, fileName);

    await fs.mkdir(coverDir, { recursive: true });
    await fs.writeFile(filePath, imageBuffer);

    return NextResponse.json({
      success: true,
      cover: `/covers/${fileName}`,
      isAIGenerated: true,
    });
  } catch (error) {
    console.error("Failed to generate AI cover:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate AI cover" },
      { status: 500 },
    );
  }
}
