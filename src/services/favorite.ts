import { FAVORITE_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

const TARGET_TYPE_ARTICLE = "article";
const FAVORITE_INVENTORY_TTL_MS = 60 * 1000;

interface FavoriteInventoryCacheEntry {
  inventory: FavoriteInventory;
  expiresAt: number;
}

const favoriteInventoryCache = new Map<string, FavoriteInventoryCacheEntry>();
const favoriteInventoryInflight = new Map<string, Promise<FavoriteInventory>>();

export interface FavoriteFolder {
  folderId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteItem {
  favoriteId: string;
  folderId: string;
  targetId: string;
  targetType: string;
  title?: string;
  cover?: string;
  createdAt: number;
}

export interface CreateFavoriteFolderPayload {
  name: string;
}

export interface UpdateFavoriteFolderPayload {
  folderId: string;
  name: string;
}

export interface CreateFavoriteItemPayload {
  folderId: string;
  targetId: string;
  targetType: string;
  title?: string;
  cover?: string;
}

export interface FavoriteTargetSnapshot {
  targetId: string;
  title?: string;
  cover?: string | null;
}

export interface FavoriteInventory {
  folders: FavoriteFolder[];
  itemsByFolderId: Record<string, FavoriteItem[]>;
  articleMap: Record<string, FavoriteItem[]>;
}

interface FavoriteFolderListResponse {
  folders?: FavoriteFolder[];
}

interface FavoriteItemListResponse {
  favorites?: FavoriteItem[];
}

interface CreateFavoriteFolderResponse {
  folderId?: string;
}

interface CreateFavoriteItemResponse {
  favoriteId?: string;
}

const normalizeId = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
};

const getTokenCacheKey = (token: string): string => token.trim();

export const invalidateFavoriteInventoryCache = (token?: string): void => {
  if (token) {
    const cacheKey = getTokenCacheKey(token);
    favoriteInventoryCache.delete(cacheKey);
    favoriteInventoryInflight.delete(cacheKey);
    return;
  }

  favoriteInventoryCache.clear();
  favoriteInventoryInflight.clear();
};

const normalizeFolder = (folder: FavoriteFolder): FavoriteFolder => ({
  ...folder,
  folderId: normalizeId(folder.folderId),
  name: typeof folder.name === "string" ? folder.name.trim() : "",
});

const normalizeItem = (item: FavoriteItem): FavoriteItem => ({
  ...item,
  favoriteId: normalizeId(item.favoriteId),
  folderId: normalizeId(item.folderId),
  targetId: normalizeId(item.targetId),
  targetType: typeof item.targetType === "string" ? item.targetType.trim() : "",
  title: typeof item.title === "string" ? item.title.trim() : "",
  cover: typeof item.cover === "string" ? item.cover.trim() : "",
});

const buildArticleMap = (
  itemsByFolderId: Record<string, FavoriteItem[]>,
): Record<string, FavoriteItem[]> => {
  const articleMap: Record<string, FavoriteItem[]> = {};

  for (const folderItems of Object.values(itemsByFolderId)) {
    for (const item of folderItems) {
      if (item.targetType !== TARGET_TYPE_ARTICLE || !item.targetId) {
        continue;
      }

      if (!articleMap[item.targetId]) {
        articleMap[item.targetId] = [];
      }
      articleMap[item.targetId].push(item);
    }
  }

  return articleMap;
};

export const listFavoriteFolders = async (token: string): Promise<FavoriteFolder[]> => {
  const response = await request<FavoriteFolderListResponse>(FAVORITE_API_PATHS.listFolders, {
    method: "GET",
    headers: withBearerAuthorization(token),
  });

  return Array.isArray(response.folders) ? response.folders.map(normalizeFolder) : [];
};

export const createFavoriteFolder = async (
  token: string,
  payload: CreateFavoriteFolderPayload,
): Promise<string> => {
  const response = await request<CreateFavoriteFolderResponse>(FAVORITE_API_PATHS.createFolder, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

  invalidateFavoriteInventoryCache(token);
  return normalizeId(response.folderId);
};

export const updateFavoriteFolder = async (
  token: string,
  payload: UpdateFavoriteFolderPayload,
): Promise<void> => {
  await request(FAVORITE_API_PATHS.updateFolder, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });
  invalidateFavoriteInventoryCache(token);
};

export const deleteFavoriteFolder = async (token: string, folderId: string): Promise<void> => {
  await request(FAVORITE_API_PATHS.deleteFolder, {
    method: "DELETE",
    headers: withBearerAuthorization(token),
    body: JSON.stringify({ folderId }),
  });
  invalidateFavoriteInventoryCache(token);
};

export const createOrFindFavoriteFolder = async (
  token: string,
  name: string,
): Promise<FavoriteFolder> => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("请输入收藏夹名称");
  }

  try {
    const folderId = await createFavoriteFolder(token, { name: normalizedName });
    return {
      folderId,
      name: normalizedName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } catch (error) {
    const folders = await listFavoriteFolders(token);
    const existing = folders.find((folder) => folder.name === normalizedName);
    if (existing) {
      return existing;
    }
    throw error;
  }
};

export const listFavoritesByFolder = async (
  token: string,
  folderId: string,
): Promise<FavoriteItem[]> => {
  const path = `${FAVORITE_API_PATHS.listItems}?folderId=${encodeURIComponent(folderId)}`;
  const response = await request<FavoriteItemListResponse>(path, {
    method: "GET",
    headers: withBearerAuthorization(token),
  });

  return Array.isArray(response.favorites) ? response.favorites.map(normalizeItem) : [];
};

export const createFavoriteItem = async (
  token: string,
  payload: CreateFavoriteItemPayload,
): Promise<string> => {
  const response = await request<CreateFavoriteItemResponse>(FAVORITE_API_PATHS.createItem, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

  invalidateFavoriteInventoryCache(token);
  return normalizeId(response.favoriteId);
};

export const deleteFavoriteItem = async (token: string, favoriteId: string): Promise<void> => {
  await request(FAVORITE_API_PATHS.deleteItem, {
    method: "DELETE",
    headers: withBearerAuthorization(token),
    body: JSON.stringify({ favoriteId }),
  });
  invalidateFavoriteInventoryCache(token);
};

const loadFavoriteInventoryFresh = async (token: string): Promise<FavoriteInventory> => {
  const folders = await listFavoriteFolders(token);
  if (!folders.length) {
    return {
      folders: [],
      itemsByFolderId: {},
      articleMap: {},
    };
  }

  const itemPairs = await Promise.all(
    folders.map(async (folder) => ({
      folderId: folder.folderId,
      items: await listFavoritesByFolder(token, folder.folderId),
    })),
  );

  const itemsByFolderId = itemPairs.reduce<Record<string, FavoriteItem[]>>((map, pair) => {
    map[pair.folderId] = pair.items;
    return map;
  }, {});

  return {
    folders,
    itemsByFolderId,
    articleMap: buildArticleMap(itemsByFolderId),
  };
};

export const loadFavoriteInventory = async (
  token: string,
  options: { force?: boolean } = {},
): Promise<FavoriteInventory> => {
  const cacheKey = getTokenCacheKey(token);
  const cached = favoriteInventoryCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.inventory;
  }

  const inflight = favoriteInventoryInflight.get(cacheKey);
  if (!options.force && inflight) {
    return inflight;
  }

  const task = loadFavoriteInventoryFresh(token);
  favoriteInventoryInflight.set(cacheKey, task);

  try {
    const inventory = await task;
    favoriteInventoryCache.set(cacheKey, {
      inventory,
      expiresAt: Date.now() + FAVORITE_INVENTORY_TTL_MS,
    });
    return inventory;
  } finally {
    if (favoriteInventoryInflight.get(cacheKey) === task) {
      favoriteInventoryInflight.delete(cacheKey);
    }
  }
};

export const getArticleFavorites = (
  inventory: FavoriteInventory,
  targetId: string,
): FavoriteItem[] => {
  return inventory.articleMap[normalizeId(targetId)] ?? [];
};

export const createArticleFavoriteInFolder = async (
  token: string,
  folderId: string,
  snapshot: FavoriteTargetSnapshot,
): Promise<FavoriteItem> => {
  const normalizedFolderId = normalizeId(folderId);
  const normalizedTargetId = normalizeId(snapshot.targetId);

  try {
    const favoriteId = await createFavoriteItem(token, {
      folderId: normalizedFolderId,
      targetId: normalizedTargetId,
      targetType: TARGET_TYPE_ARTICLE,
      title: snapshot.title?.trim() || undefined,
      cover: snapshot.cover?.trim() || undefined,
    });

    return {
      favoriteId,
      folderId: normalizedFolderId,
      targetId: normalizedTargetId,
      targetType: TARGET_TYPE_ARTICLE,
      title: snapshot.title?.trim() || "",
      cover: snapshot.cover?.trim() || "",
      createdAt: Date.now(),
    };
  } catch (error) {
    const folderItems = await listFavoritesByFolder(token, normalizedFolderId);
    const existing = folderItems.find(
      (item) => item.targetType === TARGET_TYPE_ARTICLE && item.targetId === normalizedTargetId,
    );
    if (existing) {
      return existing;
    }
    throw error;
  }
};

export const deleteFavoriteItems = async (
  token: string,
  favoriteIds: string[],
): Promise<void> => {
  const uniqueIds = Array.from(
    new Set(
      favoriteIds
        .map((favoriteId) => normalizeId(favoriteId))
        .filter((favoriteId) => Boolean(favoriteId)),
    ),
  );

  await Promise.all(uniqueIds.map((favoriteId) => deleteFavoriteItem(token, favoriteId)));
  invalidateFavoriteInventoryCache(token);
};

export const deleteArticleFavorites = async (
  token: string,
  favorites: FavoriteItem[],
): Promise<void> => {
  await deleteFavoriteItems(
    token,
    favorites.map((favorite) => favorite.favoriteId),
  );
};
