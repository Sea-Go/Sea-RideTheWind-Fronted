"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createArticleFavoriteInFolder,
  createOrFindFavoriteFolder,
  listFavoriteFolders,
  type FavoriteFolder,
  type FavoriteItem,
  type FavoriteTargetSnapshot,
} from "@/services/favorite";

interface FavoritePickerDialogProps {
  open: boolean;
  token: string | null;
  target: FavoriteTargetSnapshot | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (favorite: FavoriteItem, folder: FavoriteFolder | null) => void;
}

const MAX_FOLDER_NAME_LENGTH = 20;

export const FavoritePickerDialog = ({
  open,
  token,
  target,
  onOpenChange,
  onSaved,
}: FavoritePickerDialogProps) => {
  const [folders, setFolders] = useState<FavoriteFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.folderId === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    let cancelled = false;

    const loadFolders = async () => {
      setIsLoadingFolders(true);
      setMessage(null);

      try {
        const nextFolders = await listFavoriteFolders(token);
        if (cancelled) {
          return;
        }

        setFolders(nextFolders);
        setSelectedFolderId((current) => {
          if (current && nextFolders.some((folder) => folder.folderId === current)) {
            return current;
          }
          return nextFolders[0]?.folderId ?? "";
        });
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "收藏夹加载失败，请稍后重试");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFolders(false);
        }
      }
    };

    void loadFolders();

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const handleCreateFolder = async () => {
    if (!token) {
      setMessage("请先登录后再操作");
      return;
    }

    const normalizedName = newFolderName.trim();
    if (!normalizedName) {
      setMessage("请输入收藏夹名称");
      return;
    }
    if (normalizedName.length > MAX_FOLDER_NAME_LENGTH) {
      setMessage(`收藏夹名称最多 ${MAX_FOLDER_NAME_LENGTH} 个字`);
      return;
    }

    setIsCreatingFolder(true);
    setMessage(null);

    try {
      const folder = await createOrFindFavoriteFolder(token, normalizedName);
      const nextFolders = await listFavoriteFolders(token);
      setFolders(nextFolders);
      setSelectedFolderId(
        nextFolders.find((item) => item.folderId === folder.folderId)?.folderId ??
          nextFolders[0]?.folderId ??
          folder.folderId,
      );
      setNewFolderName("");
      setMessage(`已准备好收藏夹“${folder.name}”`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建收藏夹失败，请稍后重试");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleSave = async () => {
    if (!token || !target) {
      setMessage("请先登录后再收藏");
      return;
    }
    if (!selectedFolderId) {
      setMessage("请先选择收藏夹");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const favorite = await createArticleFavoriteInFolder(token, selectedFolderId, target);
      onSaved?.(favorite, selectedFolder);
      onOpenChange(false);
      setNewFolderName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "收藏失败，请稍后重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving || isCreatingFolder) {
      return;
    }

    if (!nextOpen) {
      setMessage(null);
      setNewFolderName("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>选择收藏夹</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.title ? `将《${target.title}》收藏到你选择的收藏夹。` : "选择一个收藏夹来保存这篇文章。"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="favorite-folder-select">已有收藏夹</Label>
            <Select
              value={selectedFolderId}
              onValueChange={setSelectedFolderId}
              disabled={isLoadingFolders || isSaving || folders.length === 0}
            >
              <SelectTrigger id="favorite-folder-select" className="w-full">
                <SelectValue placeholder={isLoadingFolders ? "正在加载收藏夹..." : "请选择收藏夹"} />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.folderId} value={folder.folderId}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {folders.length === 0 && !isLoadingFolders && (
              <p className="text-muted-foreground text-xs">你还没有收藏夹，先创建一个吧。</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="favorite-new-folder">新建收藏夹</Label>
            <div className="flex gap-2">
              <Input
                id="favorite-new-folder"
                value={newFolderName}
                maxLength={MAX_FOLDER_NAME_LENGTH}
                placeholder="例如：稍后细读"
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateFolder();
                  }
                }}
                disabled={isCreatingFolder || isSaving}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCreateFolder()}
                disabled={isCreatingFolder || isSaving}
              >
                {isCreatingFolder ? "创建中..." : "新建"}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              收藏夹名称最多 {MAX_FOLDER_NAME_LENGTH} 个字。
            </p>
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.includes("失败") || message.includes("请先") || message.includes("请输入")
                  ? "text-destructive"
                  : "text-primary"
              }`}
            >
              {message}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving || isCreatingFolder}>取消</AlertDialogCancel>
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !token}>
            {isSaving ? "收藏中..." : "确认收藏"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
