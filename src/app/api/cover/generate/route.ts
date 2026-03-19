import { NextRequest, NextResponse } from "next/server";

import {
  getRequiredArticleServerUrl,
  resolveAuthorizationHeader,
} from "@/app/api/_shared/article-upload";
import { generateCoverAssetFromContent } from "@/lib/cover";

export async function POST(request: NextRequest) {
  try {
    const { title, content } = await request.json();

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "Article content is required" },
        { status: 400 },
      );
    }

    const authorization = resolveAuthorizationHeader(request);
    if (!authorization) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await generateCoverAssetFromContent({
      title,
      content,
      upload: {
        articleServerUrl: getRequiredArticleServerUrl(),
        authorization,
      },
    });

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
    });
  } catch (error) {
    console.error("Failed to generate AI cover:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate AI cover" },
      { status: 500 },
    );
  }
}
