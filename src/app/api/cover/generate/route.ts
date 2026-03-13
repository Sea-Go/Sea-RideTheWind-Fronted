import { NextResponse } from "next/server";

import { generateCoverAssetFromContent } from "@/lib/cover";

export async function POST(request: Request) {
  try {
    const { title, content } = await request.json();

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "Article content is required" },
        { status: 400 },
      );
    }
    const result = await generateCoverAssetFromContent({ title, content });

    return NextResponse.json({
      success: true,
      cover: result.cover,
      isAIGenerated: true,
      prompt: result.prompt,
      promptSource: result.promptSource,
      promptGroundingMatchedCount: result.promptGroundingMatchedCount,
      summary: result.summary,
      summarySource: result.summarySource,
      summaryGroundingScore: result.summaryGroundingScore,
      summaryPath: result.summaryPath,
    });
  } catch (error) {
    console.error("Failed to generate AI cover:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate AI cover" },
      { status: 500 },
    );
  }
}
