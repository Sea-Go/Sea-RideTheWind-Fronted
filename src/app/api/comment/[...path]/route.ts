import { NextRequest } from "next/server";

import { createProxyHandler, type ProxyRouteContext } from "@/app/api/_shared/proxy";

const COMMENT_V1_PREFIX = "/comment/v1";

const proxyRequest = createProxyHandler({
  envVarName: "COMMENT_API_SERVER_URL",
  proxyName: "comment-proxy",
  unavailableMessage: "Comment service unavailable",
  resolveUpstreamPath: (path) => {
    if (path.length === 0) {
      return null;
    }

    if (path[0] === "v1") {
      const rest = path.slice(1).join("/");
      return rest ? `${COMMENT_V1_PREFIX}/${rest}` : COMMENT_V1_PREFIX;
    }

    return `/${path.join("/")}`;
  },
});

export async function GET(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}
