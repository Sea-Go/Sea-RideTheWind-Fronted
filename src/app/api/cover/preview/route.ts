import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "175.24.130.226",
  "sea-ridethewindbreakthewaves.xyz",
]);

const getAllowedHosts = (): Set<string> => {
  const hosts = new Set(DEFAULT_ALLOWED_HOSTS);
  const articleServerUrl = process.env.ARTICLE_API_SERVER_URL?.trim();
  if (!articleServerUrl) {
    return hosts;
  }

  try {
    hosts.add(new URL(articleServerUrl).hostname);
  } catch {
    return hosts;
  }

  return hosts;
};

const resolveTargetUrl = (rawUrl: string | null): URL | null => {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!getAllowedHosts().has(parsed.hostname)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const buildResponseHeaders = (upstreamResponse: Response): Headers => {
  const headers = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  headers.set("cache-control", "no-store");
  return headers;
};

export async function GET(request: NextRequest): Promise<Response> {
  const targetUrl = resolveTargetUrl(request.nextUrl.searchParams.get("url"));
  if (!targetUrl) {
    return NextResponse.json({ success: false, error: "invalid_cover_url" }, { status: 400 });
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "image/*",
      },
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { success: false, error: "cover_preview_unavailable" },
        { status: upstreamResponse.status },
      );
    }

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: buildResponseHeaders(upstreamResponse),
    });
  } catch (error) {
    console.error("Failed to preview cover:", error);
    return NextResponse.json(
      { success: false, error: "cover_preview_unavailable" },
      { status: 502 },
    );
  }
}
