import { NextRequest, NextResponse } from "next/server";

import {
  ARTICLE_UPLOAD_UPSTREAM_PATH,
  getRequiredArticleServerUrl,
  resolveAuthorizationHeader,
} from "@/app/api/_shared/article-upload";

const buildResponseHeaders = (upstreamResponse: Response): Headers => {
  const headers = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  return headers;
};

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authorization = resolveAuthorizationHeader(request);
    if (!authorization) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Cover image is required" },
        { status: 400 },
      );
    }

    const upstreamFormData = new FormData();
    upstreamFormData.append("image", image, image.name);

    const upstreamResponse = await fetch(
      `${getRequiredArticleServerUrl()}${ARTICLE_UPLOAD_UPSTREAM_PATH}`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
        },
        body: upstreamFormData,
        cache: "no-store",
      },
    );

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: buildResponseHeaders(upstreamResponse),
    });
  } catch (error) {
    console.error("Failed to upload cover:", error);
    return NextResponse.json({ success: false, error: "Failed to upload cover" }, { status: 502 });
  }
}
