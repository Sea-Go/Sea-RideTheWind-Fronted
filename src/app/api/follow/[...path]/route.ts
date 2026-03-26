import { NextRequest } from "next/server";

import { createProxyHandler, type ProxyRouteContext } from "@/app/api/_shared/proxy";

const FOLLOW_V1_PREFIX = "/follow/v1";

const proxyRequest = createProxyHandler({
  envVarName: "FOLLOW_API_SERVER_URL",
  proxyName: "follow-proxy",
  unavailableMessage: "关注服务暂时不可用",
  resolveUpstreamPath: (path) => {
    if (path.length === 0) {
      return null;
    }

    if (path[0] === "v1") {
      const rest = path.slice(1).join("/");
      return rest ? `${FOLLOW_V1_PREFIX}/${rest}` : FOLLOW_V1_PREFIX;
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
