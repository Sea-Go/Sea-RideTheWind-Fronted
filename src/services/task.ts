import { TASK_CENTER_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export interface GetTaskProgressPayload {
  id: number;
}

export interface TaskProgressItem {
  name: string;
  desc: string;
  taskId: number;
  completionProgress: number;
  requiredProgress: number;
}

export interface GetTaskProgressResponse {
  tasks: TaskProgressItem[];
}

export interface GetTaskProgressOptions {
  token?: string;
}

export const getTaskProgress = (
  payload: GetTaskProgressPayload,
  options?: GetTaskProgressOptions,
): Promise<GetTaskProgressResponse> =>
  request<GetTaskProgressResponse>(TASK_CENTER_API_PATHS.getTaskProgress, {
    method: "POST",
    headers: options?.token ? withBearerAuthorization(options.token) : undefined,
    body: JSON.stringify(payload),
  });
