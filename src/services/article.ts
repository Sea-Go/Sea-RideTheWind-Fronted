import { ARTICLE_API_PATHS, COVER_API_PATHS } from "@/constants/api-paths";
import { extractUploadError, extractUploadUrl } from "@/lib/upload-response";
import { type ApiResponse, request, withBearerAuthorization } from "@/services/request";

export const MAX_COVER_UPLOAD_SIZE_BYTES = Math.floor(2.5 * 1024 * 1024);
export const MAX_COVER_UPLOAD_SIZE_LABEL = "2.5 MB";

const normalizeServerUrl = (value?: string): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
};

const DIRECT_ARTICLE_UPLOAD_BASE_URL = normalizeServerUrl(
  process.env.NEXT_PUBLIC_ARTICLE_API_SERVER_URL,
);

interface UploadTarget {
  endpoint: string;
  includeAuthorization: boolean;
}

const resolveUploadTarget = (fallbackEndpoint: string): UploadTarget => {
  if (!DIRECT_ARTICLE_UPLOAD_BASE_URL) {
    return {
      endpoint: fallbackEndpoint,
      includeAuthorization: true,
    };
  }

  return {
    endpoint: `${DIRECT_ARTICLE_UPLOAD_BASE_URL}/v1/upload`,
    includeAuthorization: false,
  };
};

export interface ArticlePayload {
  title?: string;
  brief?: string;
  content?: string;
  cover_image_url?: string;
  manual_type_tag?: string;
  secondary_tags?: string[];
  status?: number;
}

export interface CreateArticlePayload extends ArticlePayload {
  title: string;
  content: string;
}

export interface UpdateArticlePayload extends ArticlePayload {
  id?: string;
}

export interface ListArticlesParams {
  manual_type_tag?: string;
  secondary_tag?: string;
  related_game_id?: string;
  author_id?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  desc?: boolean;
}

export interface GetArticleOptions {
  token?: string;
  incr_view?: boolean;
}

export interface ArticleItem {
  id?: string | number;
  article_id?: string | number;
  author_id?: string | number;
  author_name?: string;
  username?: string;
  title?: string;
  brief?: string;
  content?: string;
  cover_image_url?: string;
  cover?: string;
  status?: number;
  like_count?: number;
  likes?: number;
  view_count?: number;
  comment_count?: number;
  share_count?: number;
  create_time?: string | number;
  update_time?: string | number;
  created_at?: string;
  published_at?: string;
  manual_type_tag?: string;
  secondary_tags?: string[];
  ext_info?: Record<string, string>;
  [key: string]: unknown;
}

export interface ArticleResponse {
  article?: ArticleItem;
  [key: string]: unknown;
}

export interface CreateArticleResponse {
  article_id?: string;
  [key: string]: unknown;
}

export interface ArticleListResponse {
  list?: ArticleItem[];
  articles?: ArticleItem[];
  items?: ArticleItem[];
  records?: ArticleItem[];
  total?: number;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

const appendQueryParams = (
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string => {
  if (!params) {
    return path;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

const uploadArticleAsset = async (
  target: UploadTarget,
  token: string,
  file: File,
  maxBytes?: number,
): Promise<string> => {
  if (typeof maxBytes === "number" && file.size > maxBytes) {
    throw new Error(`图片过大，请上传小于 ${MAX_COVER_UPLOAD_SIZE_LABEL} 的文件。`);
  }

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: target.includeAuthorization ? withBearerAuthorization(token) : undefined,
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch (error) {
    void error;
  }

  if (!response.ok) {
    throw new Error(extractUploadError(payload) ?? "图片上传失败，请稍后重试。");
  }

  const uploadedUrl = extractUploadUrl(payload);
  if (!uploadedUrl) {
    throw new Error("上传成功但未返回封面地址，请稍后重试。");
  }

  return uploadedUrl;
};

export const uploadArticleCover = async (token: string, file: File): Promise<string> =>
  uploadArticleAsset(resolveUploadTarget(COVER_API_PATHS.upload), token, file, MAX_COVER_UPLOAD_SIZE_BYTES);

export const uploadArticleInlineImage = async (token: string, file: File): Promise<string> =>
  uploadArticleAsset(resolveUploadTarget(ARTICLE_API_PATHS.upload), token, file);

export const createArticle = (
  token: string,
  payload: CreateArticlePayload,
): Promise<ApiResponse<CreateArticleResponse | null>> =>
  request<ApiResponse<CreateArticleResponse | null>>(ARTICLE_API_PATHS.create, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const getArticle = (id: string, options?: GetArticleOptions): Promise<ArticleResponse> =>
  request<ArticleResponse>(
    appendQueryParams(ARTICLE_API_PATHS.getById(id), {
      incr_view: options?.incr_view,
    }),
    {
      method: "GET",
      headers: options?.token ? withBearerAuthorization(options.token) : undefined,
    },
  );

export const listArticles = (params?: ListArticlesParams): Promise<ArticleListResponse> =>
  request<ArticleListResponse>(
    appendQueryParams(ARTICLE_API_PATHS.list, {
      manual_type_tag: params?.manual_type_tag,
      secondary_tag: params?.secondary_tag,
      related_game_id: params?.related_game_id,
      author_id: params?.author_id,
      page: params?.page,
      page_size: params?.page_size,
      sort_by: params?.sort_by,
      desc: params?.desc,
    }),
    {
      method: "GET",
    },
  );

export const updateArticle = (
  token: string,
  id: string,
  payload: UpdateArticlePayload,
): Promise<ArticleResponse> =>
  request<ArticleResponse>(ARTICLE_API_PATHS.updateById(id), {
    method: "PUT",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const deleteArticle = (token: string, id: string): Promise<ArticleResponse> =>
  request<ArticleResponse>(ARTICLE_API_PATHS.deleteById(id), {
    method: "DELETE",
    headers: withBearerAuthorization(token),
  });
