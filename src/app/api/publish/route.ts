import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

import {
  getRequiredArticleServerUrl,
  resolveAuthorizationHeader,
} from "@/app/api/_shared/article-upload";
import { generateCoverAssetFromContent } from "@/lib/cover";

const escapeYamlString = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export async function POST(request: NextRequest) {
  try {
    const { title, content, cover } = await request.json();

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "文章标题不能为空" },
        { status: 400 },
      );
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "文章内容不能为空" },
        { status: 400 },
      );
    }

    let finalCover = typeof cover === "string" && cover.trim() ? cover.trim() : "";
    if (!finalCover) {
      const authorization = resolveAuthorizationHeader(request);
      if (!authorization) {
        return NextResponse.json({ success: false, error: "未授权访问" }, { status: 401 });
      }

      const generatedResult = await generateCoverAssetFromContent({
        title: title.trim(),
        content: content.trim(),
        upload: {
          articleServerUrl: getRequiredArticleServerUrl(),
          authorization,
        },
      });

      finalCover = generatedResult.cover;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const second = String(now.getSeconds()).padStart(2, "0");
    const fileName = `${year}${month}${day}${hour}${minute}${second}.md`;

    const filePath = path.join(process.cwd(), "public", fileName);

    const frontmatter = `---\ntitle: "${escapeYamlString(title.trim())}"\ncover: "${escapeYamlString(finalCover)}"\npublishedAt: "${now.toISOString()}"\n---\n\n`;
    await fs.writeFile(filePath, `${frontmatter}${content}`, "utf-8");

    return NextResponse.json({
      success: true,
      path: `/${fileName}`,
      title: title.trim(),
      cover: finalCover,
    });
  } catch (error) {
    console.error("Failed to save markdown file:", error);
    return NextResponse.json({ success: false, error: "保存文件失败" }, { status: 500 });
  }
}
