import { NextRequest, NextResponse } from "next/server";

import {
  getBearerToken,
  trimServerUrl,
  unauthorizedAdminResponse,
  validateAdminToken,
} from "@/app/api/admin/_shared/auth";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
const GRAFANA_PROXY_PREFIX = "/api/admin/grafana";
const TEXT_REWRITE_CONTENT_TYPES = [
  "text/html",
  "text/css",
  "application/javascript",
  "text/javascript",
  "application/json",
];

interface GrafanaRouteContext {
  params: Promise<{
    path?: string[];
  }>;
}

const getGrafanaUrl = (): string =>
  trimServerUrl(
    process.env.GRAFANA_INTERNAL_URL ?? process.env.GRAFANA_SERVER_URL ?? "http://localhost:33000",
  );

const buildGrafanaPath = (path: string[] = []): string => {
  if (!path.length) {
    return GRAFANA_PROXY_PREFIX;
  }
  return `${GRAFANA_PROXY_PREFIX}/${path.map((item) => encodeURIComponent(item)).join("/")}`;
};

const buildGrafanaHeaders = (request: NextRequest): Headers => {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");
  const userAgent = request.headers.get("user-agent");
  if (accept) {
    headers.set("accept", accept);
  }
  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (userAgent) {
    headers.set("user-agent", userAgent);
  }

  const user = process.env.GRAFANA_ADMIN_USER ?? "admin";
  const password = process.env.GRAFANA_ADMIN_PASSWORD ?? "admin";
  headers.set("authorization", `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`);
  return headers;
};

const shouldRewriteText = (contentType: string): boolean =>
  TEXT_REWRITE_CONTENT_TYPES.some((item) => contentType.includes(item));

const rewriteGrafanaText = (text: string, origin: string): string => {
  const prefix = GRAFANA_PROXY_PREFIX;
  return text
    .replace(/(href|src)="\/(?!\/|api\/admin\/grafana\/)/g, `$1="${prefix}/`)
    .replace(/url\(\/(?!\/|api\/admin\/grafana\/)/g, `url(${prefix}/`)
    .replace(/"appSubUrl"\s*:\s*"[^"]*"/g, `"appSubUrl":"${prefix}"`)
    .replace(/"appUrl"\s*:\s*"[^"]*"/g, `"appUrl":"${origin}${prefix}/"`)
    .replace(/"liveEnabled"\s*:\s*true/g, `"liveEnabled":false`)
    .replace(/"liveNamespaced"\s*:\s*true/g, `"liveNamespaced":false`);
};

const buildResponseHeaders = (response: Response, request: NextRequest): Headers => {
  const headers = new Headers();
  const passThrough = [
    "content-type",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
  ] as const;

  for (const key of passThrough) {
    const value = response.headers.get(key);
    if (value) {
      headers.set(key, value);
    }
  }

  const location = response.headers.get("location");
  if (location) {
    if (location.startsWith("/")) {
      headers.set("location", `/api/admin/grafana${location}`);
    } else {
      const grafanaUrl = getGrafanaUrl();
      try {
        const parsedLocation = new URL(location);
        if (parsedLocation.pathname.startsWith("/api/admin/grafana")) {
          headers.set(
            "location",
            `${request.nextUrl.origin}${parsedLocation.pathname}${parsedLocation.search}${parsedLocation.hash}`,
          );
        } else {
          headers.set(
            "location",
            location.replace(grafanaUrl, `${request.nextUrl.origin}/api/admin/grafana`),
          );
        }
      } catch {
        headers.set(
          "location",
          location.replace(grafanaUrl, `${request.nextUrl.origin}/api/admin/grafana`),
        );
      }
    }
  }

  headers.delete("x-frame-options");
  headers.delete("content-security-policy");
  return headers;
};

async function proxyGrafana(request: NextRequest, context: GrafanaRouteContext): Promise<Response> {
  const token = getBearerToken(request);
  const authorized = await validateAdminToken(token, {
    skipEnvVar: "GRAFANA_PROXY_SKIP_ADMIN_AUTH",
  });
  if (!authorized) {
    return unauthorizedAdminResponse();
  }

  const grafanaUrl = getGrafanaUrl();
  if (!grafanaUrl) {
    return NextResponse.json(
      { code: 503, msg: "Grafana 服务地址未配置", data: null },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const upstreamUrl = `${grafanaUrl}${buildGrafanaPath(path)}${request.nextUrl.search}`;
  const upstreamBody = BODYLESS_METHODS.has(method) ? undefined : await request.arrayBuffer();

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: buildGrafanaHeaders(request),
      body: upstreamBody && upstreamBody.byteLength > 0 ? upstreamBody : undefined,
      cache: "no-store",
      redirect: "manual",
    });
    const contentType = upstreamResponse.headers.get("content-type") ?? "";
    const responseHeaders = buildResponseHeaders(upstreamResponse, request);

    if (shouldRewriteText(contentType)) {
      const text = await upstreamResponse.text();
      return new Response(rewriteGrafanaText(text, request.nextUrl.origin), {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { code: 502, msg: "Grafana 服务暂时不可用", data: null },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: GrafanaRouteContext): Promise<Response> {
  return proxyGrafana(request, context);
}

export async function POST(request: NextRequest, context: GrafanaRouteContext): Promise<Response> {
  return proxyGrafana(request, context);
}

export async function PUT(request: NextRequest, context: GrafanaRouteContext): Promise<Response> {
  return proxyGrafana(request, context);
}

export async function PATCH(request: NextRequest, context: GrafanaRouteContext): Promise<Response> {
  return proxyGrafana(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: GrafanaRouteContext,
): Promise<Response> {
  return proxyGrafana(request, context);
}

export async function OPTIONS(
  request: NextRequest,
  context: GrafanaRouteContext,
): Promise<Response> {
  return proxyGrafana(request, context);
}
