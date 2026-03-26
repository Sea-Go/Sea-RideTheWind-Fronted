import { TASK_CENTER_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export interface GetTaskProgressPayload {
  id: string;
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

const INVALID_TASK_USER_ID_MESSAGE = "当前账号缺少有效用户编号，暂时无法加载任务。";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toText = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const normalizeTaskProgressItem = (value: unknown): TaskProgressItem | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const taskId = toNumber(record.taskId ?? record.task_id ?? record.Task_id, 0);
  const name = toText(record.name);
  if (!taskId || !name) {
    return null;
  }

  return {
    taskId,
    name,
    desc: toText(record.desc),
    completionProgress: Math.max(
      0,
      toNumber(
        record.completionProgress ?? record.completion_progress ?? record.Completion_progress,
        0,
      ),
    ),
    requiredProgress: Math.max(
      0,
      toNumber(record.requiredProgress ?? record.required_progress ?? record.Required_progress, 0),
    ),
  };
};

export const normalizeTaskProgressItems = (value: unknown): TaskProgressItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeTaskProgressItem(item))
    .filter((item): item is TaskProgressItem => item !== null);
};

export const parseTaskUserId = (value: string | number): string => {
  const normalized =
    typeof value === "string"
      ? value.trim()
      : Number.isSafeInteger(value) && value > 0
        ? String(value)
        : "";

  if (!normalized) {
    throw new Error(INVALID_TASK_USER_ID_MESSAGE);
  }

  return normalized;
};

export const getTaskProgress = (
  payload: GetTaskProgressPayload,
  options?: GetTaskProgressOptions,
): Promise<GetTaskProgressResponse> =>
  request<GetTaskProgressResponse>(TASK_CENTER_API_PATHS.getTaskProgress, {
    method: "POST",
    headers: options?.token ? withBearerAuthorization(options.token) : undefined,
    body: JSON.stringify(payload),
  });

export const getTaskProgressByUserId = async (
  userId: string | number,
  options?: GetTaskProgressOptions,
): Promise<TaskProgressItem[]> => {
  const normalizedUserId = parseTaskUserId(userId);
  const response = await getTaskProgress(
    { id: normalizedUserId },
    {
      token: options?.token,
    },
  );

  return normalizeTaskProgressItems(response.tasks);
};
