import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const getFileExtension = (mimeType: string) => {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  if (mimeType === "image/gif") {
    return "gif";
  }
  return "png";
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Cover file is required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported image type",
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate(),
    ).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(
      now.getMinutes(),
    ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const extension = getFileExtension(file.type);
    const fileName = `cover-${timestamp}.${extension}`;
    const coverDir = path.join(process.cwd(), "public", "covers");
    const filePath = path.join(coverDir, fileName);

    await fs.mkdir(coverDir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ success: true, cover: `/covers/${fileName}` });
  } catch (error) {
    console.error("Failed to upload cover:", error);
    return NextResponse.json({ success: false, error: "Failed to upload cover" }, { status: 500 });
  }
}
