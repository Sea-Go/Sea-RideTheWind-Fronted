import { NextRequest } from "next/server";

import { createProxyHandler, type ProxyRouteContext } from "@/app/api/_shared/proxy";

const HOT_V1_PREFIX = "/hot";

const proxyRequest = createProxyHandler({
  envVarName: "HOT_API_SERVER_URL",
  proxyName: "hot-proxy",
  unavailableMessage: "热榜服务暂时不可用",
  resolveUpstreamPath: (path) => {
    if (path.length === 0) {
      return null;
    }

    if (path[0] === "v1") {
      const rest = path.join("/");
      return `${HOT_V1_PREFIX}/${rest}`;
    }

    return `${HOT_V1_PREFIX}/${path.join("/")}`;
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
