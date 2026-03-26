import { HOT_API_PATHS } from "@/constants/api-paths";
import { request } from "@/services/request";

export interface HotArticleItem {
  article_id: string;
  rank: number;
  hot_score: number;
  title: string;
  brief: string;
  cover_image_url: string;
  author_id: string;
  create_time: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  manual_type_tag: string;
  secondary_tags: string[];
}

export interface HotArticlesResponse {
  items: HotArticleItem[];
  total: number;
  page: number;
  page_size: number;
  scope: string;
}

export interface GetHotArticlesParams {
  page?: number;
  page_size?: number;
}

export const getHotArticles = (
  params?: GetHotArticlesParams,
): Promise<HotArticlesResponse> =>
  request<HotArticlesResponse>(HOT_API_PATHS.list(params?.page ?? 1, params?.page_size ?? 20), {
    method: "GET",
  });
