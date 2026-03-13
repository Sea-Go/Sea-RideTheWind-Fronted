import { NextRequest } from "next/server";

import { createProxyHandler, type ProxyRouteContext } from "@/app/api/_shared/proxy";

const buildUpstreamPath = (path: string[]): string | null => {
  if (path.length === 0) {
    return null;
  }

  if (path[0] === "v1") {
    const rest = path.slice(1).join("/");
    return rest ? `/api/v1/${rest}` : "/api/v1";
  }

  if (path.length === 1 && path[0] === "health") {
    return "/health";
  }

  return null;
};

const proxyRequest = createProxyHandler({
  envVarName: "RECO_API_SERVER_URL",
  proxyName: "reco-proxy",
  unavailableMessage: "Reco service unavailable",
  notFoundMessage: "Reco route not found",
  resolveUpstreamPath: buildUpstreamPath,
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
