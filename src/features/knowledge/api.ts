import { getAdminAuthToken } from "@/services/admin";
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
  FreezeWikiFactSetReq,
  JudgeWikiFactReq,
  ListModulesResp,
  ListRevisionsResp,
  ListWikiFactJudgmentsResp,
  Module,
  ProductAnswerCitationStates,
  Release,
  ReleaseState,
  Revision,
  WikiFactJudgmentRecord,
  WikiFactSetRecord,
  WikiPageHeadSnapshot,
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
/** Human Wiki review uses the administrator session even when a browser also
 * holds an ordinary User Center token. RTW remains the authority on the role.
 */
export function knowledgeAdminRequest<T>(
  path: string,
  init: RequestInit & { strictJSON?: boolean } = {},
) {
  const token = getAdminAuthToken();
  return request<T>(`/api/sea/knowledge/${path}`, {
    ...init,
    cache: "no-store",
    responseMode: "wrapped",
    headers: token ? withBearerAuthorization(token, init.headers) : init.headers,
  });
}
const get = <T>(path: string, signal?: AbortSignal, strictJSON = false) =>
  knowledgeRequest<T>(path, { signal, strictJSON });
const adminGet = <T>(path: string, signal?: AbortSignal) =>
  knowledgeAdminRequest<T>(path, { signal });
const adminPost = <T>(path: string, data: unknown) =>
  knowledgeAdminRequest<T>(path, { method: "POST", body: JSON.stringify(data) });
export const knowledge = {
  modules: (cursor = "", signal?: AbortSignal, workbench = false) =>
    (workbench ? adminGet<ListModulesResp> : get<ListModulesResp>)(
      `${workbench ? "workbench/" : ""}modules?limit=12${cursor ? `&cursor=${part(cursor)}` : ""}`,
      signal,
    ),
  module: (id: string, signal?: AbortSignal) => get<Module>(modulePath(id), signal),
  published: (id: string, signal?: AbortSignal) =>
    get<Release>(`${modulePath(id)}/published`, signal),
  revisions: (id: string, signal?: AbortSignal) =>
    adminGet<ListRevisionsResp>(`${modulePath(id)}/revisions`, signal),
  current: (id: string, signal?: AbortSignal) =>
    adminGet<ReleaseState>(`${modulePath(id)}/releases/current`, signal),
  createModule: (data: CreateModuleReq) => adminPost<Module>("modules", data),
  source: (id: string, data: CreateSourceReq) =>
    adminPost<Revision>(`${modulePath(id)}/sources`, data),
  wiki: (id: string, page: string, data: CreateWikiReq) =>
    adminPost<Revision>(`${modulePath(id)}/wiki-pages/${part(page)}/revisions`, data),
  compile: (id: string, data: CreateCompileReq) =>
    adminPost<Compile>(`${modulePath(id)}/compiles`, data),
  cancelCompile: (id: string, data: CancelCompileReq) =>
    adminPost<Compile>(`compiles/${part(id)}/cancel`, data),
  release: (id: string, data: CreateReleaseReq) =>
    adminPost<Release>(`${modulePath(id)}/releases`, data),
  build: (id: string, data: CreateBuildReq) =>
    adminPost<Build>(`releases/${part(id)}/index-builds`, data),
  cancelBuild: (id: string, data: CancelBuildReq) =>
    adminPost<Build>(`builds/${part(id)}/cancel`, data),
  activate: (id: string, data: ActivateReq) =>
    knowledgeAdminRequest<ReleaseState>(`${modulePath(id)}/activation`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export type KnowledgePage<T> = { items: T[]; next_cursor?: string };
const pageQuery = (cursor = "") => `?limit=20${cursor ? `&cursor=${part(cursor)}` : ""}`;
export const knowledgeRead = {
  module: (id: string, signal?: AbortSignal) =>
    adminGet<Module>(`workbench/${modulePath(id)}`, signal),
  revisions: (id: string, cursor = "", signal?: AbortSignal) =>
    adminGet<KnowledgePage<Revision>>(`${modulePath(id)}/revisions${pageQuery(cursor)}`, signal),
  revision: (id: string, revision: string, signal?: AbortSignal) =>
    adminGet<Revision>(`${modulePath(id)}/revisions/${part(revision)}`, signal),
  releases: (id: string, cursor = "", signal?: AbortSignal) =>
    adminGet<KnowledgePage<Release>>(`${modulePath(id)}/releases${pageQuery(cursor)}`, signal),
  release: (id: string, release: string, signal?: AbortSignal) =>
    adminGet<Release>(`${modulePath(id)}/releases/${part(release)}`, signal),
  builds: (id: string, cursor = "", signal?: AbortSignal) =>
    adminGet<KnowledgePage<Build>>(`${modulePath(id)}/builds${pageQuery(cursor)}`, signal),
  build: (id: string, build: string, signal?: AbortSignal) =>
    adminGet<Build>(`${modulePath(id)}/builds/${part(build)}`, signal),
  compiles: (id: string, cursor = "", signal?: AbortSignal) =>
    adminGet<KnowledgePage<Compile>>(`${modulePath(id)}/compiles${pageQuery(cursor)}`, signal),
  compile: (id: string, compile: string, signal?: AbortSignal) =>
    adminGet<Compile>(`${modulePath(id)}/compiles/${part(compile)}`, signal),
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

const wikiPagePath = (moduleId: string, pageId: string) =>
  `${modulePath(moduleId)}/wiki-pages/${part(pageId)}`;
const wikiFactPath = (moduleId: string, pageId: string, wikiRevisionId: string) =>
  `${wikiPagePath(moduleId, pageId)}/revisions/${part(wikiRevisionId)}/quality-judgments`;
export const knowledgeQuality = {
  editingHead: (moduleId: string, pageId: string, signal?: AbortSignal) =>
    knowledgeAdminRequest<WikiPageHeadSnapshot>(`${wikiPagePath(moduleId, pageId)}/head`, {
      signal,
    }),
  judgments: (
    moduleId: string,
    pageId: string,
    wikiRevisionId: string,
    cursor = "",
    signal?: AbortSignal,
  ) =>
    knowledgeAdminRequest<ListWikiFactJudgmentsResp>(
      `${wikiFactPath(moduleId, pageId, wikiRevisionId)}?limit=20${cursor ? `&cursor=${part(cursor)}` : ""}`,
      { signal },
    ),
  judgment: (moduleId: string, pageId: string, wikiRevisionId: string, factId: string) =>
    knowledgeAdminRequest<WikiFactJudgmentRecord>(
      `${wikiFactPath(moduleId, pageId, wikiRevisionId)}/${part(factId)}`,
    ),
  judge: (moduleId: string, pageId: string, wikiRevisionId: string, input: JudgeWikiFactReq) =>
    knowledgeAdminRequest<WikiFactJudgmentRecord>(wikiFactPath(moduleId, pageId, wikiRevisionId), {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

const wikiFactSetPath = (moduleId: string, pageId: string) => `${wikiPagePath(moduleId, pageId)}`;
/** Product admin routes only. Original Event bytes belong to the Worker API. */
export const knowledgeFactSets = {
  scope: (moduleId: string, pageId: string, sourceScopeRevision: string, signal?: AbortSignal) =>
    adminGet<WikiFactSetRecord>(
      `${wikiFactSetPath(moduleId, pageId)}/fact-sets/${part(sourceScopeRevision)}`,
      signal,
    ),
  revision: (moduleId: string, pageId: string, factSetRevisionId: string, signal?: AbortSignal) =>
    adminGet<WikiFactSetRecord>(
      `${wikiFactSetPath(moduleId, pageId)}/fact-set-revisions/${part(factSetRevisionId)}`,
      signal,
    ),
  freeze: (moduleId: string, pageId: string, wikiRevisionId: string, input: FreezeWikiFactSetReq) =>
    adminPost<WikiFactSetRecord>(
      `${wikiFactSetPath(moduleId, pageId)}/revisions/${part(wikiRevisionId)}/fact-sets`,
      input,
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
      true,
    ),
};
