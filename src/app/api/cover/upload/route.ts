import { NextRequest, NextResponse } from "next/server";

import {
  ARTICLE_UPLOAD_UPSTREAM_PATH,
  getRequiredArticleServerUrl,
  resolveAuthorizationHeader,
} from "@/app/api/_shared/article-upload";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

const buildUpstreamHeaders = (request: NextRequest, authorization: string | null): Headers => {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");

  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (accept) {
    headers.set("accept", accept);
  }
  if (authorization) {
    headers.set("authorization", authorization);
  }

  return headers;
};

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
    const body = BODYLESS_METHODS.has(request.method.toUpperCase())
      ? undefined
      : await request.arrayBuffer();

    const upstreamResponse = await fetch(
      `${getRequiredArticleServerUrl()}${ARTICLE_UPLOAD_UPSTREAM_PATH}`,
      {
        method: "POST",
        headers: buildUpstreamHeaders(request, authorization),
        body: body && body.byteLength > 0 ? body : undefined,
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
    return NextResponse.json(
      { success: false, error: "封面上传失败，请稍后重试。" },
      { status: 502 },
    );
  }
}
