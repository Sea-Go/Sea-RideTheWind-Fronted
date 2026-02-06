import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

export async function POST(request: Request) {
  try {
    const { content } = await request.json();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const second = String(now.getSeconds()).padStart(2, "0");
    const fileName = `${year}${month}${day}${hour}${minute}${second}.md`;

    const filePath = path.join(process.cwd(), "public", fileName);

    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({ success: true, path: `/${fileName}` });
  } catch (error) {
    console.error("Failed to save markdown file:", error);
    return NextResponse.json({ success: false, error: "Failed to save file" }, { status: 500 });
  }
}
