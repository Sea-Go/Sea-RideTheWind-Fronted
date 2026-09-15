import { getAuthToken } from "@/services/auth";
import { request, withBearerAuthorization } from "@/services/request";

import type { HistoricalAcceptedAnswer, HistoricalAcceptedAnswersPage } from "./answer-history";
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
  ProductAnswerCitationStates,
  Release,
  ReleaseState,
  Revision,
} from "./generated/knowledgeComponents";

export type * from "./generated/knowledgeComponents";
const part = encodeURIComponent;
const modulePath = (id: string) => `modules/${part(id)}`;
export function knowledgeRequest<T>(
  path: string,
  init: RequestInit & { strictJSON?: boolean } = {},
) {
  const token = getAuthToken();
  return request<T>(`/api/sea/knowledge/${path}`, {
    ...init,
    cache: "no-store",
    responseMode: "wrapped",
    headers: token ? withBearerAuthorization(token, init.headers) : init.headers,
  });
}
const get = <T>(path: string, signal?: AbortSignal, strictJSON = false) =>
  knowledgeRequest<T>(path, { signal, strictJSON });
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

export type KnowledgePage<T> = { items: T[]; next_cursor?: string };
const pageQuery = (cursor = "") => `?limit=20${cursor ? `&cursor=${part(cursor)}` : ""}`;
export const knowledgeRead = {
  module: (id: string, signal?: AbortSignal) => get<Module>(`workbench/${modulePath(id)}`, signal),
  revisions: (id: string, cursor = "", signal?: AbortSignal) =>
    get<KnowledgePage<Revision>>(`${modulePath(id)}/revisions${pageQuery(cursor)}`, signal),
  revision: (id: string, revision: string, signal?: AbortSignal) =>
    get<Revision>(`${modulePath(id)}/revisions/${part(revision)}`, signal),
  releases: (id: string, cursor = "", signal?: AbortSignal) =>
    get<KnowledgePage<Release>>(`${modulePath(id)}/releases${pageQuery(cursor)}`, signal),
  release: (id: string, release: string, signal?: AbortSignal) =>
    get<Release>(`${modulePath(id)}/releases/${part(release)}`, signal),
  builds: (id: string, cursor = "", signal?: AbortSignal) =>
    get<KnowledgePage<Build>>(`${modulePath(id)}/builds${pageQuery(cursor)}`, signal),
  build: (id: string, build: string, signal?: AbortSignal) =>
    get<Build>(`${modulePath(id)}/builds/${part(build)}`, signal),
  compiles: (id: string, cursor = "", signal?: AbortSignal) =>
    get<KnowledgePage<Compile>>(`${modulePath(id)}/compiles${pageQuery(cursor)}`, signal),
  compile: (id: string, compile: string, signal?: AbortSignal) =>
    get<Compile>(`${modulePath(id)}/compiles/${part(compile)}`, signal),
  publishedRelease: (id: string, release: string, signal?: AbortSignal) =>
    get<Release>(`${modulePath(id)}/published-releases/${part(release)}`, signal),
  publishedRevisions: (id: string, release: string, cursor = "", signal?: AbortSignal) =>
    get<KnowledgePage<Revision>>(
      `${modulePath(id)}/releases/${part(release)}/revisions${pageQuery(cursor)}`,
      signal,
    ),
  publishedRevision: (id: string, release: string, revision: string, signal?: AbortSignal) =>
    get<Revision>(
      `${modulePath(id)}/releases/${part(release)}/revisions/${part(revision)}`,
      signal,
    ),
};

// Product answer history is scoped by RTW to the verified User Center JWT.
// The browser supplies only a logical session ID, pagination, and an answer ID.
export const knowledgeAnswerHistory = {
  list: (sessionId: string, afterOrdinal = 0, signal?: AbortSignal) =>
    get<HistoricalAcceptedAnswersPage>(
      `answer-sessions/${part(sessionId)}/accepted-answers?limit=20${afterOrdinal ? `&after_ordinal=${afterOrdinal}` : ""}`,
      signal,
      true,
    ),
  answer: (sessionId: string, answerId: string, signal?: AbortSignal) =>
    get<HistoricalAcceptedAnswer>(
      `answer-sessions/${part(sessionId)}/accepted-answers/${part(answerId)}`,
      signal,
      true,
    ),
  citationStates: (sessionId: string, answerId: string, signal?: AbortSignal) =>
    get<ProductAnswerCitationStates>(
      `answer-sessions/${part(sessionId)}/accepted-answers/${part(answerId)}/citations`,
      signal,
    ),
};
