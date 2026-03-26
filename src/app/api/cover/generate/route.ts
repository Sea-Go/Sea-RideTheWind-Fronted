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
        { success: false, error: "文章内容不能为空" },
        { status: 400 },
      );
    }

    const authorization = resolveAuthorizationHeader(request);
    if (!authorization) {
      return NextResponse.json({ success: false, error: "未授权访问" }, { status: 401 });
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
      { success: false, error: "智能封面生成失败" },
      { status: 500 },
    );
  }
}
