import { NextRequest, NextResponse } from "next/server";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
const UPSTREAM_HEADER_KEYS = ["content-type", "authorization", "accept"] as const;

interface RouteParams {
  path: string[];
}

export interface ProxyRouteContext {
  params: Promise<RouteParams>;
}

interface CreateProxyHandlerOptions {
  envVarName: string;
  proxyName: string;
  unavailableMessage: string;
  notFoundMessage?: string;
  resolveUpstreamPath: (path: string[]) => string | null;
}

const getRequiredServerUrl = (envVarName: string, proxyName: string): string => {
  const value = process.env[envVarName]?.trim();
  if (!value) {
    throw new Error(`[${proxyName}] 缺少必要环境变量：${envVarName}`);
  }
  return value.replace(/\/+$/, "");
};

const buildUpstreamHeaders = (request: NextRequest): Headers => {
  const headers = new Headers();

  for (const key of UPSTREAM_HEADER_KEYS) {
    const value = request.headers.get(key);
    if (value) {
      headers.set(key, value);
    }
  }

  return headers;
};

const buildResponseHeaders = (response: Response): Headers => {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  return headers;
};

export const createProxyHandler = (
  options: CreateProxyHandlerOptions,
): ((request: NextRequest, context: ProxyRouteContext) => Promise<Response>) => {
  const serverUrl = getRequiredServerUrl(options.envVarName, options.proxyName);

  return async (request: NextRequest, context: ProxyRouteContext): Promise<Response> => {
    const { path } = await context.params;
    const upstreamPath = options.resolveUpstreamPath(path);

    if (!upstreamPath) {
      return NextResponse.json(
        { code: 404, msg: options.notFoundMessage ?? "请求路径不存在", data: null },
        { status: 404 },
      );
    }

    const method = request.method.toUpperCase();
    const upstreamBody = BODYLESS_METHODS.has(method) ? undefined : await request.arrayBuffer();
    const upstreamUrl = `${serverUrl}${upstreamPath}${request.nextUrl.search}`;

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method,
        headers: buildUpstreamHeaders(request),
        body: upstreamBody && upstreamBody.byteLength > 0 ? upstreamBody : undefined,
        cache: "no-store",
      });

      return new Response(await upstreamResponse.arrayBuffer(), {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: buildResponseHeaders(upstreamResponse),
      });
    } catch (error) {
      console.error(`Failed to proxy ${options.proxyName} request:`, error);
      return NextResponse.json(
        { code: 502, msg: options.unavailableMessage, data: null },
        { status: 502 },
      );
    }
  };
};
