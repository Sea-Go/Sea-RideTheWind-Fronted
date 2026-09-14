import { getAuthToken } from "@/services/auth";
import { request, withBearerAuthorization } from "@/services/request";

import type {
  ActivateReq,
  Build,
  CancelBuildReq,
  CancelCompileReq,
  Compile,
  CreateBuildReq,
  CreateCompileReq,
  CreateModuleReq,
  CreateReleaseReq,
  CreateSourceReq,
  CreateWikiReq,
  ListModulesResp,
  ListRevisionsResp,
  Module,
  Release,
  ReleaseState,
  Revision,
} from "./generated/knowledgeComponents";

export type * from "./generated/knowledgeComponents";
const part = encodeURIComponent;
const modulePath = (id: string) => `modules/${part(id)}`;
export function knowledgeRequest<T>(path: string, init: RequestInit = {}) {
  const token = getAuthToken();
  return request<T>(`/api/sea/knowledge/${path}`, {
    ...init,
    cache: "no-store",
    responseMode: "wrapped",
    headers: token ? withBearerAuthorization(token, init.headers) : init.headers,
  });
}
const get = <T>(path: string, signal?: AbortSignal) => knowledgeRequest<T>(path, { signal });
const post = <T>(path: string, data: unknown) =>
  knowledgeRequest<T>(path, { method: "POST", body: JSON.stringify(data) });
export const knowledge = {
  modules: (cursor = "", signal?: AbortSignal, workbench = false) =>
    get<ListModulesResp>(
      `${workbench ? "workbench/" : ""}modules?limit=12${cursor ? `&cursor=${part(cursor)}` : ""}`,
      signal,
    ),
  module: (id: string, signal?: AbortSignal) => get<Module>(modulePath(id), signal),
  published: (id: string, signal?: AbortSignal) =>
    get<Release>(`${modulePath(id)}/published`, signal),
  revisions: (id: string, signal?: AbortSignal) =>
    get<ListRevisionsResp>(`${modulePath(id)}/revisions`, signal),
  current: (id: string, signal?: AbortSignal) =>
    get<ReleaseState>(`${modulePath(id)}/releases/current`, signal),
  createModule: (data: CreateModuleReq) => post<Module>("modules", data),
  source: (id: string, data: CreateSourceReq) => post<Revision>(`${modulePath(id)}/sources`, data),
  wiki: (id: string, page: string, data: CreateWikiReq) =>
    post<Revision>(`${modulePath(id)}/wiki-pages/${part(page)}/revisions`, data),
  compile: (id: string, data: CreateCompileReq) =>
    post<Compile>(`${modulePath(id)}/compiles`, data),
  cancelCompile: (id: string, data: CancelCompileReq) =>
    post<Compile>(`compiles/${part(id)}/cancel`, data),
  release: (id: string, data: CreateReleaseReq) =>
    post<Release>(`${modulePath(id)}/releases`, data),
  build: (id: string, data: CreateBuildReq) =>
    post<Build>(`releases/${part(id)}/index-builds`, data),
  cancelBuild: (id: string, data: CancelBuildReq) => post<Build>(`builds/${part(id)}/cancel`, data),
  activate: (id: string, data: ActivateReq) =>
    knowledgeRequest<ReleaseState>(`${modulePath(id)}/activation`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
