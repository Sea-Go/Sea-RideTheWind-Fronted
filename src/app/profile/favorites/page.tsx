"use client";

import {
  BookmarkIcon,
  CheckIcon,
  FolderIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
  PencilLineIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
} from "@/services/auth";
import {
  createFavoriteFolder,
  deleteFavoriteFolder,
  deleteFavoriteItem,
  listFavoriteFolders,
  listFavoritesByFolder,
  updateFavoriteFolder,
  type FavoriteFolder,
  type FavoriteItem,
} from "@/services/favorite";

const buildErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function ProfileFavoritesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [folders, setFolders] = useState<FavoriteFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [busyFavoriteId, setBusyFavoriteId] = useState<string | null>(null);
  const [createFolderName, setCreateFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [updatingFolderId, setUpdatingFolderId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.folderId === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/profile/favorites");
      return;
    }

    if (!userToken) {
      setErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setIsLoading(false);
      return;
    }

    setToken(userToken);
    setErrorMessage(null);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadFolders = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setActionMessage(null);

      try {
        const nextFolders = await listFavoriteFolders(token);
        setFolders(nextFolders);
        setSelectedFolderId(nextFolders[0]?.folderId ?? "");
      } catch (error) {
        setErrorMessage(buildErrorMessage(error, "收藏夹加载失败，请稍后重试"));
      } finally {
        setIsLoading(false);
      }
    };

    void loadFolders();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedFolderId) {
      setItems([]);
      setIsItemsLoading(false);
      return;
    }

    const loadItems = async () => {
      setIsItemsLoading(true);
      setErrorMessage(null);

      try {
        const nextItems = await listFavoritesByFolder(token, selectedFolderId);
        setItems(nextItems);
      } catch (error) {
        setErrorMessage(buildErrorMessage(error, "收藏内容加载失败，请稍后重试"));
      } finally {
        setIsItemsLoading(false);
      }
    };

    void loadItems();
  }, [selectedFolderId, token]);

  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    if (editingFolderId && editingFolderId !== folderId) {
      setEditingFolderId(null);
      setEditingFolderName("");
    }
    setActionMessage(null);
  };

  const handleCreateFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || isCreatingFolder) {
      return;
    }

    const normalizedName = createFolderName.trim();
    if (!normalizedName) {
      setActionMessage("请输入收藏夹名称");
      return;
    }

    setIsCreatingFolder(true);
    setErrorMessage(null);
    setActionMessage(null);

    try {
      const folderId = await createFavoriteFolder(token, { name: normalizedName });
      const now = Date.now();
      const nextFolder: FavoriteFolder = {
        folderId,
        name: normalizedName,
        createdAt: now,
        updatedAt: now,
      };

      setFolders((prev) => [nextFolder, ...prev]);
      setSelectedFolderId(folderId);
      setCreateFolderName("");
      setEditingFolderId(null);
      setEditingFolderName("");
      setActionMessage(`已新建收藏夹“${normalizedName}”`);
    } catch (error) {
      setActionMessage(buildErrorMessage(error, "新建收藏夹失败，请稍后重试"));
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const beginRenameFolder = (folder: FavoriteFolder) => {
    setEditingFolderId(folder.folderId);
    setEditingFolderName(folder.name);
    setActionMessage(null);
    setErrorMessage(null);
    setSelectedFolderId(folder.folderId);
  };

  const cancelRenameFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const handleRenameFolder = async (event: FormEvent<HTMLFormElement>, folder: FavoriteFolder) => {
    event.preventDefault();

    if (!token || updatingFolderId) {
      return;
    }

    const normalizedName = editingFolderName.trim();
    if (!normalizedName) {
      setActionMessage("请输入新的收藏夹名称");
      return;
    }

    if (normalizedName === folder.name) {
      cancelRenameFolder();
      return;
    }

    setUpdatingFolderId(folder.folderId);
    setErrorMessage(null);
    setActionMessage(null);

    try {
      await updateFavoriteFolder(token, {
        folderId: folder.folderId,
        name: normalizedName,
      });

      setFolders((prev) =>
        prev.map((item) =>
          item.folderId === folder.folderId
            ? {
                ...item,
                name: normalizedName,
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
      setEditingFolderId(null);
      setEditingFolderName("");
      setActionMessage(`已将收藏夹重命名为“${normalizedName}”`);
    } catch (error) {
      setActionMessage(buildErrorMessage(error, "修改收藏夹失败，请稍后重试"));
    } finally {
      setUpdatingFolderId(null);
    }
  };

  const handleDeleteFolder = async (folder: FavoriteFolder) => {
    if (!token || deletingFolderId) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除收藏夹“${folder.name}”吗？这个收藏夹里的内容也会一起移除。`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingFolderId(folder.folderId);
    setErrorMessage(null);
    setActionMessage(null);

    try {
      await deleteFavoriteFolder(token, folder.folderId);

      const remainingFolders = folders.filter((item) => item.folderId !== folder.folderId);
      setFolders(remainingFolders);
      setSelectedFolderId((current) =>
        current === folder.folderId ? (remainingFolders[0]?.folderId ?? "") : current,
      );
      if (!remainingFolders.length || selectedFolderId === folder.folderId) {
        setItems([]);
      }
      if (editingFolderId === folder.folderId) {
        setEditingFolderId(null);
        setEditingFolderName("");
      }
      setActionMessage(`已删除收藏夹“${folder.name}”`);
    } catch (error) {
      setActionMessage(buildErrorMessage(error, "删除收藏夹失败，请稍后重试"));
    } finally {
      setDeletingFolderId(null);
    }
  };

  const handleDeleteFavorite = async (favoriteId: string) => {
    if (!token || busyFavoriteId) {
      return;
    }

    setBusyFavoriteId(favoriteId);
    setActionMessage(null);

    try {
      await deleteFavoriteItem(token, favoriteId);
      setItems((prev) => prev.filter((item) => item.favoriteId !== favoriteId));
      setActionMessage("已取消收藏");
    } catch (error) {
      setActionMessage(buildErrorMessage(error, "取消收藏失败，请稍后重试"));
    } finally {
      setBusyFavoriteId(null);
    }
  };

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">我的收藏</h1>
            <p className="text-muted-foreground text-sm">
              先挑一个收藏夹，再在下面查看这个收藏夹里装着的文章。
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">返回个人中心</Link>
            </Button>
          </header>

          {isLoading ? (
            <p className="text-muted-foreground">收藏夹加载中...</p>
          ) : (
            <div className="space-y-6">
              <section className="bg-card rounded-3xl border p-5 shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">新建收藏夹</h2>
                  <p className="text-muted-foreground text-sm">
                    给你的文章准备一个新筐，之后点收藏时就能往里面放。
                  </p>
                </div>

                <form
                  onSubmit={(event) => void handleCreateFolder(event)}
                  className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
                >
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="favorite-folder-create">收藏夹名称</Label>
                    <Input
                      id="favorite-folder-create"
                      value={createFolderName}
                      onChange={(event) => setCreateFolderName(event.target.value)}
                      maxLength={20}
                      placeholder="例如：晚点细读 / 旅行灵感 / 夏目友人帐"
                      disabled={isCreatingFolder}
                    />
                  </div>
                  <Button type="submit" className="min-w-36" disabled={isCreatingFolder}>
                    {isCreatingFolder ? (
                      <>
                        <LoaderCircleIcon className="size-4 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      <>
                        <FolderPlusIcon className="size-4" />
                        新建收藏夹
                      </>
                    )}
                  </Button>
                </form>
              </section>

              <section className="bg-card space-y-4 rounded-3xl border p-5 shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">收藏夹</h2>
                  <p className="text-muted-foreground text-sm">
                    把收藏夹当成装文章的筐，点一下某个筐，下面就会展开它装着的内容。
                  </p>
                </div>

                {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
                {actionMessage ? <p className="text-primary text-sm">{actionMessage}</p> : null}

                {folders.length === 0 ? (
                  <div className="text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center">
                    你还没有收藏夹，先在上方新建一个吧。
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {folders.map((folder) => {
                        const isSelected = folder.folderId === selectedFolderId;
                        const isBusy =
                          deletingFolderId === folder.folderId ||
                          updatingFolderId === folder.folderId;

                        return (
                          <button
                            key={folder.folderId}
                            type="button"
                            onClick={() => handleSelectFolder(folder.folderId)}
                            className={`min-w-56 rounded-2xl border px-4 py-4 text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/8 shadow-sm"
                                : "border-border bg-background hover:border-primary/40 hover:bg-accent/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div
                                  className={`inline-flex size-10 items-center justify-center rounded-2xl ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <FolderIcon className="size-5" />
                                </div>
                                <div className="space-y-1">
                                  <p className="truncate text-base font-semibold">{folder.name}</p>
                                  <p className="text-muted-foreground text-xs">
                                    {isSelected ? "当前打开的收藏筐" : "点击查看这个收藏夹里的文章"}
                                  </p>
                                </div>
                              </div>
                              {isBusy ? (
                                <LoaderCircleIcon className="text-muted-foreground size-4 animate-spin" />
                              ) : (
                                <BookmarkIcon
                                  className={`size-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {!selectedFolder ? (
                      <div className="text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center">
                        请选择一个收藏夹，然后在下面查看它装着的文章。
                      </div>
                    ) : (
                      <div className="space-y-4 border-t pt-4">
                        <div className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(135deg,rgba(248,250,252,0.94),rgba(239,246,255,0.92))] p-4 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-2">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm">
                              <BookmarkIcon className="size-3.5" />
                              当前收藏筐
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-2xl font-semibold tracking-tight">
                                {selectedFolder.name}
                              </h3>
                              <p className="text-muted-foreground text-sm">
                                {isItemsLoading
                                  ? "正在打开这个收藏夹..."
                                  : `这个收藏夹里现在有 ${items.length} 篇文章`}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 md:items-end">
                            <div className="text-muted-foreground inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs shadow-sm">
                              <FolderIcon className="size-3.5" />
                              收藏夹 ID：{selectedFolder.folderId}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => beginRenameFolder(selectedFolder)}
                                disabled={deletingFolderId === selectedFolder.folderId}
                              >
                                <PencilLineIcon className="size-4" />
                                修改名称
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => void handleDeleteFolder(selectedFolder)}
                                disabled={deletingFolderId === selectedFolder.folderId}
                              >
                                {deletingFolderId === selectedFolder.folderId ? (
                                  <>
                                    <LoaderCircleIcon className="size-4 animate-spin" />
                                    删除中...
                                  </>
                                ) : (
                                  <>
                                    <Trash2Icon className="size-4" />
                                    删除收藏夹
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {editingFolderId === selectedFolder.folderId ? (
                          <form
                            onSubmit={(event) => void handleRenameFolder(event, selectedFolder)}
                            className="border-primary/30 bg-primary/5 space-y-3 rounded-2xl border p-4"
                          >
                            <div className="space-y-2">
                              <Label htmlFor={`favorite-folder-edit-${selectedFolder.folderId}`}>
                                修改收藏夹名称
                              </Label>
                              <Input
                                id={`favorite-folder-edit-${selectedFolder.folderId}`}
                                value={editingFolderName}
                                onChange={(event) => setEditingFolderName(event.target.value)}
                                maxLength={20}
                                disabled={Boolean(updatingFolderId)}
                                autoFocus
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="submit" size="sm" disabled={Boolean(updatingFolderId)}>
                                {updatingFolderId ? (
                                  <>
                                    <LoaderCircleIcon className="size-4 animate-spin" />
                                    保存中...
                                  </>
                                ) : (
                                  <>
                                    <CheckIcon className="size-4" />
                                    保存
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={cancelRenameFolder}
                                disabled={Boolean(updatingFolderId)}
                              >
                                <XIcon className="size-4" />
                                取消
                              </Button>
                            </div>
                          </form>
                        ) : null}

                        {isItemsLoading ? (
                          <p className="text-muted-foreground py-8 text-center">
                            收藏内容加载中...
                          </p>
                        ) : items.length === 0 ? (
                          <div className="text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center">
                            这个收藏夹里还没有文章，去文章页点一下“收藏”试试吧。
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => (
                              <div
                                key={item.favoriteId}
                                className="bg-background space-y-4 rounded-2xl border p-4 shadow-sm"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-1 text-xs">
                                      {item.targetType || "文章"}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      ID：{item.targetId}
                                    </span>
                                  </div>
                                  <h4 className="text-lg leading-7 font-semibold">
                                    {item.title || `文章 ${item.targetId}`}
                                  </h4>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  {item.targetType === "article" ? (
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/article/${encodeURIComponent(item.targetId)}`}>
                                        查看文章
                                      </Link>
                                    </Button>
                                  ) : null}
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => void handleDeleteFavorite(item.favoriteId)}
                                    disabled={busyFavoriteId === item.favoriteId}
                                  >
                                    {busyFavoriteId === item.favoriteId ? "处理中..." : "取消收藏"}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
