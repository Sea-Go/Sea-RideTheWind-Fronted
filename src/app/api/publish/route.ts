import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

const escapeYamlString = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export async function POST(request: Request) {
  try {
    const { title, content, cover } = await request.json();

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "Article title is required" },
        { status: 400 },
      );
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "Article content is required" },
        { status: 400 },
      );
    }

    if (typeof cover !== "string" || !cover.trim()) {
      return NextResponse.json({ success: false, error: "Cover is required" }, { status: 400 });
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

    const frontmatter = `---\ntitle: "${escapeYamlString(title.trim())}"\ncover: "${escapeYamlString(cover)}"\npublishedAt: "${now.toISOString()}"\n---\n\n`;
    await fs.writeFile(filePath, `${frontmatter}${content}`, "utf-8");

    return NextResponse.json({ success: true, path: `/${fileName}`, title: title.trim(), cover });
  } catch (error) {
    console.error("Failed to save markdown file:", error);
    return NextResponse.json({ success: false, error: "Failed to save file" }, { status: 500 });
  }
}
