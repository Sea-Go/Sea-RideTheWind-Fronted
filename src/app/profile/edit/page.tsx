"use client";

import {
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2Icon,
  SaveIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  type ProfileThemeId,
  profileThemes,
  resolveProfileThemeId,
} from "@/components/profile/profile-theme-config";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  type AvatarHistoryItem,
  getFrontendAccessState,
  getProfileAvatarUrl,
  getUserAvatarHistory,
  getUserProfile,
  selectUserAvatar,
  updateUserProfile,
  uploadUserAvatar,
  type UserProfile,
} from "@/services/auth";

const MAX_AVATAR_UPLOAD_BYTES = 2.5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_UPLOAD_HINT = "支持 JPG、PNG、WebP，大小不超过 2.5MB";

const isEnabled = (value: string | undefined, fallback: boolean): boolean => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
};

const syncProfileTheme = (themeId: ProfileThemeId): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PROFILE_THEME_STORAGE_KEY, themeId);
  window.dispatchEvent(
    new CustomEvent(PROFILE_THEME_EVENT_NAME, {
      detail: { themeId },
    }),
  );
};

const buildBaseExtraInfo = (extraInfo: Record<string, string>): Record<string, string> => {
  const nextExtraInfo = { ...extraInfo };
  delete nextExtraInfo.avatar;
  return nextExtraInfo;
};

const buildBioExtraInfo = ({
  extraInfo,
  bio,
}: {
  extraInfo: Record<string, string>;
  bio: string;
}): Record<string, string> => {
  const nextExtraInfo = buildBaseExtraInfo(extraInfo);
  delete nextExtraInfo.hobby;

  const normalizedBio = bio.trim();
  if (normalizedBio) {
    nextExtraInfo.bio = normalizedBio;
  } else {
    delete nextExtraInfo.bio;
  }

  return nextExtraInfo;
};

export default function ProfileEditPage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [selectingHistoryId, setSelectingHistoryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [extraInfo, setExtraInfo] = useState<Record<string, string>>({});

  const [uid, setUid] = useState("");
  const [score, setScore] = useState(0);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [themeId, setThemeId] = useState<ProfileThemeId>("ocean");
  const [showArticlesOnProfile, setShowArticlesOnProfile] = useState(true);
  const [receiveInteractionNotifications, setReceiveInteractionNotifications] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [avatarHistory, setAvatarHistory] = useState<AvatarHistoryItem[]>([]);

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/profile/edit");
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

    const loadProfile = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setAvatarMessage(null);
      setProfileMessage(null);
      setPasswordMessage(null);

      try {
        const response = await getUserProfile(token);
        const nextExtraInfo = response.user.extra_info ?? {};
        const storedThemeId =
          typeof window === "undefined"
            ? ""
            : window.localStorage.getItem(PROFILE_THEME_STORAGE_KEY);
        const nextThemeId = resolveProfileThemeId(storedThemeId || nextExtraInfo.profile_theme);

        setUid(response.user.uid ?? "");
        setScore(response.user.score);
        setUsername(response.user.username ?? "");
        setEmail(response.user.email ?? "");
        setBio(nextExtraInfo.bio ?? nextExtraInfo.hobby ?? "");
        setAvatarUrl(getProfileAvatarUrl(response.user));
        setThemeId(nextThemeId);
        setShowArticlesOnProfile(isEnabled(nextExtraInfo.show_articles_on_profile, true));
        setReceiveInteractionNotifications(
          isEnabled(nextExtraInfo.receive_interaction_notifications, true),
        );
        setExtraInfo(nextExtraInfo);
        syncProfileTheme(nextThemeId);

        try {
          const history = await getUserAvatarHistory(token);
          setAvatarHistory(history.list ?? []);
        } catch (error) {
          setAvatarHistory([]);
          setAvatarMessage(error instanceof Error ? error.message : "头像历史加载失败。");
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "用户资料加载失败。");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [token]);

  const passwordError = useMemo(() => {
    if (!currentPassword && !newPassword && !confirmPassword) {
      return "";
    }
    if (!currentPassword.trim()) {
      return "请输入当前密码。";
    }
    if (!newPassword.trim()) {
      return "请输入新密码。";
    }
    if (newPassword.length < 6) {
      return "新密码至少需要 6 位。";
    }
    if (newPassword !== confirmPassword) {
      return "两次输入的新密码不一致。";
    }
    return "";
  }, [confirmPassword, currentPassword, newPassword]);

  const canSaveProfile = useMemo(
    () => Boolean(username.trim() && token && !isProfileSaving && !isLoading),
    [username, token, isProfileSaving, isLoading],
  );

  const canSavePassword = useMemo(
    () =>
      Boolean(
        currentPassword.trim() &&
        newPassword.trim() &&
        confirmPassword.trim() &&
        token &&
        !isPasswordSaving &&
        !isLoading &&
        !passwordError,
      ),
    [
      currentPassword,
      newPassword,
      confirmPassword,
      token,
      isPasswordSaving,
      isLoading,
      passwordError,
    ],
  );

  const handleThemeChange = (nextThemeId: ProfileThemeId) => {
    setThemeId(nextThemeId);
    setExtraInfo((currentExtraInfo) => ({
      ...buildBaseExtraInfo(currentExtraInfo),
      profile_theme: nextThemeId,
    }));
    syncProfileTheme(nextThemeId);
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file || !token) {
      return;
    }

    setAvatarMessage(null);
    setErrorMessage(null);

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setAvatarMessage("头像仅支持 JPG、PNG 或 WebP 格式。");
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
      setAvatarMessage("头像不能超过 2.5MB。");
      return;
    }

    setIsAvatarUploading(true);
    try {
      const response = await uploadUserAvatar(token, file);
      setAvatarUrl(response.avatar_url);
      setAvatarHistory((items) =>
        [
          response.history,
          ...items.map((item) => ({ ...item, is_current: item.id === response.history.id })),
        ].slice(0, 30),
      );
      setAvatarMessage("头像已更新。");
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "头像上传失败。");
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleSelectAvatar = async (historyId: string) => {
    if (!token || selectingHistoryId) {
      return;
    }
    setSelectingHistoryId(historyId);
    setAvatarMessage(null);
    try {
      const response = await selectUserAvatar(token, historyId);
      setAvatarUrl(response.avatar_url);
      setAvatarHistory((items) =>
        items.map((item) => ({ ...item, is_current: item.id === response.history.id })),
      );
      setAvatarMessage("头像已切换。");
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "头像切换失败。");
    } finally {
      setSelectingHistoryId(null);
    }
  };

  const applyUserProfileResponse = (
    user: UserProfile,
    fallbackExtraInfo: Record<string, string>,
  ) => {
    const responseExtraInfo = user.extra_info ?? fallbackExtraInfo;

    setUsername(user.username ?? username.trim());
    setEmail(user.email ?? email.trim());
    setBio(responseExtraInfo.bio ?? responseExtraInfo.hobby ?? "");
    setAvatarUrl(getProfileAvatarUrl(user) || avatarUrl);
    setThemeId(resolveProfileThemeId(responseExtraInfo.profile_theme));
    setShowArticlesOnProfile(isEnabled(responseExtraInfo.show_articles_on_profile, true));
    setReceiveInteractionNotifications(
      isEnabled(responseExtraInfo.receive_interaction_notifications, true),
    );
    setExtraInfo(responseExtraInfo);
  };

  const handleProfileSave = async () => {
    if (!token || !username.trim()) {
      return;
    }

    setIsProfileSaving(true);
    setErrorMessage(null);
    setProfileMessage(null);

    try {
      const nextExtraInfo = buildBioExtraInfo({
        extraInfo,
        bio,
      });
      const response = await updateUserProfile(token, {
        username: username.trim(),
        email: email.trim() || undefined,
        extra_info: nextExtraInfo,
      });
      applyUserProfileResponse(response.user, nextExtraInfo);
      setProfileMessage("资料已保存。");
    } catch (error) {
      setProfileMessage(`资料保存失败：${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!token || !currentPassword.trim() || !newPassword.trim() || passwordError) {
      return;
    }

    setIsPasswordSaving(true);
    setErrorMessage(null);
    setPasswordMessage(null);

    try {
      await updateUserProfile(token, {
        current_password: currentPassword.trim(),
        password: newPassword.trim(),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPasswordVisible(false);
      setNewPasswordVisible(false);
      setConfirmPasswordVisible(false);
      setPasswordMessage("密码已更新。");
    } catch (error) {
      setPasswordMessage(
        `密码更新失败：${error instanceof Error ? error.message : "请稍后重试。"}`,
      );
    } finally {
      setIsPasswordSaving(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="mx-auto max-w-5xl">
          <div className="app-surface-elevated shadow-primary/10 rounded-[1.75rem] p-4 md:p-6">
            <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary border-primary/20 inline-flex h-9 w-9 items-center justify-center rounded-xl border">
                  <UserRoundIcon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight md:text-3xl">编辑个人资料</h1>
                  <p className="text-muted-foreground text-sm">更新你的个人信息，展示更好的自己</p>
                </div>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link href="/profile">
                  <ArrowLeftIcon className="h-4 w-4" />
                  返回个人中心
                </Link>
              </Button>
            </header>

            {isLoading ? (
              <div className="border-border/70 bg-background/75 mb-5 rounded-2xl border px-4 py-3 text-sm">
                资料加载中...
              </div>
            ) : null}

            <section className="app-surface-soft grid overflow-hidden rounded-[1.45rem] md:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-border/70 bg-background/70 flex flex-col items-center gap-4 border-b p-5 text-center md:border-r md:border-b-0">
                <div className="w-full text-left">
                  <h2 className="text-primary text-base font-semibold">头像</h2>
                  <p className="text-muted-foreground mt-1 text-xs">{AVATAR_UPLOAD_HINT}</p>
                </div>

                <ProfileAvatar avatarUrl={avatarUrl} uid={uid} username={username} size="xl" />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void handleAvatarChange(event)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isLoading || isAvatarUploading}
                >
                  {isAvatarUploading ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CameraIcon className="h-4 w-4" />
                  )}
                  更换头像
                </Button>

                {avatarMessage ? (
                  <p
                    className={cn(
                      "text-xs leading-5",
                      avatarMessage.includes("失败") || avatarMessage.includes("不能")
                        ? "text-destructive"
                        : "text-primary",
                    )}
                  >
                    {avatarMessage}
                  </p>
                ) : null}

                <div className="w-full pt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">历史头像</span>
                    <span className="text-muted-foreground text-xs">{avatarHistory.length}/30</span>
                  </div>
                  {avatarHistory.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {avatarHistory.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            "app-surface-soft hover:border-primary/50 relative rounded-2xl p-1 transition hover:-translate-y-0.5",
                            item.is_current && "border-primary ring-primary/20 ring-2",
                          )}
                          onClick={() => void handleSelectAvatar(item.id)}
                          disabled={item.is_current || Boolean(selectingHistoryId)}
                          aria-label={item.is_current ? "当前头像" : "设为当前头像"}
                        >
                          <ProfileAvatar
                            avatarUrl={item.avatar_url}
                            uid={uid}
                            username={username}
                            size="md"
                            className="h-12 w-12 rounded-xl text-base ring-0"
                          />
                          {item.is_current ? (
                            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full">
                              <CheckIcon className="h-3 w-3" />
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="app-empty-state rounded-2xl px-3 py-4 text-center text-xs">
                      暂无历史头像
                    </p>
                  )}
                </div>

                <div className="text-muted-foreground w-full border-t pt-4 text-sm">
                  <p className="text-foreground font-semibold">{username.trim() || "识海用户"}</p>
                  <p className="mt-1 break-all">UID：{uid || "--"}</p>
                  <p className="mt-1">积分：{score}</p>
                </div>
              </aside>

              <div className="space-y-5 p-5">
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="text-primary h-5 w-5" />
                    <h2 className="text-xl font-semibold tracking-tight">基础信息</h2>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="profile-username">用户名</Label>
                      <Input
                        id="profile-username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        maxLength={32}
                        disabled={isLoading || isProfileSaving}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="profile-email">邮箱</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={isLoading || isProfileSaving}
                      />
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="profile-bio">个人简介</Label>
                        <span className="text-muted-foreground text-xs">{bio.length}/100</span>
                      </div>
                      <textarea
                        id="profile-bio"
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        maxLength={100}
                        disabled={isLoading || isProfileSaving}
                        className="border-input focus-visible:border-ring focus-visible:ring-ring/25 min-h-24 w-full rounded-2xl border bg-[var(--app-input-surface)] px-4 py-3 text-sm shadow-xs backdrop-blur transition outline-none focus-visible:bg-[var(--app-input-focus-surface)] focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleProfileSave()}
                        disabled={!canSaveProfile}
                      >
                        {isProfileSaving ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <SaveIcon className="h-4 w-4" />
                        )}
                        {isProfileSaving ? "保存中..." : "保存资料"}
                      </Button>
                      {profileMessage ? (
                        <p
                          className={cn(
                            "text-sm",
                            profileMessage.includes("失败") ? "text-destructive" : "text-primary",
                          )}
                        >
                          {profileMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="border-border/70 bg-background/60 space-y-4 rounded-[1.35rem] border p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="text-primary h-5 w-5" />
                    <h2 className="text-xl font-semibold tracking-tight">账号与安全</h2>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="profile-current-password">当前密码</Label>
                      <div className="relative">
                        <Input
                          id="profile-current-password"
                          type={currentPasswordVisible ? "text" : "password"}
                          autoComplete="current-password"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          maxLength={64}
                          className="pr-10"
                          disabled={isLoading || isPasswordSaving}
                          placeholder="输入当前密码"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1/2 right-1 -translate-y-1/2"
                          onClick={() => setCurrentPasswordVisible((visible) => !visible)}
                          aria-label={currentPasswordVisible ? "隐藏当前密码" : "显示当前密码"}
                          disabled={isLoading || isPasswordSaving}
                        >
                          {currentPasswordVisible ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="profile-new-password">新密码</Label>
                      <div className="relative">
                        <Input
                          id="profile-new-password"
                          type={newPasswordVisible ? "text" : "password"}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          maxLength={64}
                          className="pr-10"
                          disabled={isLoading || isPasswordSaving}
                          placeholder="输入新密码"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1/2 right-1 -translate-y-1/2"
                          onClick={() => setNewPasswordVisible((visible) => !visible)}
                          aria-label={newPasswordVisible ? "隐藏新密码" : "显示新密码"}
                          disabled={isLoading || isPasswordSaving}
                        >
                          {newPasswordVisible ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="profile-confirm-password">确认新密码</Label>
                      <div className="relative">
                        <Input
                          id="profile-confirm-password"
                          type={confirmPasswordVisible ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          maxLength={64}
                          className="pr-10"
                          disabled={isLoading || isPasswordSaving}
                          placeholder="再次输入新密码"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1/2 right-1 -translate-y-1/2"
                          onClick={() => setConfirmPasswordVisible((visible) => !visible)}
                          aria-label={confirmPasswordVisible ? "隐藏确认密码" : "显示确认密码"}
                          disabled={isLoading || isPasswordSaving}
                        >
                          {confirmPasswordVisible ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {passwordError ? (
                    <p className="text-destructive text-sm">{passwordError}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => void handlePasswordSave()}
                      disabled={!canSavePassword}
                    >
                      {isPasswordSaving ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheckIcon className="h-4 w-4" />
                      )}
                      {isPasswordSaving ? "更新中..." : "更新密码"}
                    </Button>
                    {passwordMessage ? (
                      <p
                        className={cn(
                          "text-sm",
                          passwordMessage.includes("失败") ? "text-destructive" : "text-primary",
                        )}
                      >
                        {passwordMessage}
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="border-border/70 bg-background/60 space-y-4 rounded-[1.35rem] border p-4">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontalIcon className="text-primary h-5 w-5" />
                    <h2 className="text-xl font-semibold tracking-tight">偏好设置</h2>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-3">
                      <Label>主题偏好</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {profileThemes.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => handleThemeChange(theme.id)}
                            disabled={isLoading}
                            className={cn(
                              "app-surface-soft hover:border-primary/50 flex items-center gap-3 rounded-2xl p-3 text-left text-sm transition",
                              themeId === theme.id && "border-primary ring-primary/15 ring-2",
                            )}
                          >
                            <span
                              className="h-8 w-8 rounded-xl border border-white shadow-sm"
                              style={{ backgroundImage: theme.heroGradient }}
                            />
                            <span className="font-medium">{theme.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>内容展示</Label>
                      <label className="app-surface-soft flex items-center gap-3 rounded-2xl px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={showArticlesOnProfile}
                          onChange={(event) => setShowArticlesOnProfile(event.target.checked)}
                          disabled={isLoading}
                          className="accent-primary h-4 w-4"
                        />
                        在个人主页展示文章列表
                      </label>
                      <label className="app-surface-soft flex items-center gap-3 rounded-2xl px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={receiveInteractionNotifications}
                          onChange={(event) =>
                            setReceiveInteractionNotifications(event.target.checked)
                          }
                          disabled={isLoading}
                          className="accent-primary h-4 w-4"
                        />
                        接收评论和消息通知
                      </label>
                    </div>
                  </div>
                </section>

                {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
              </div>
            </section>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <Link href="/profile">取消</Link>
              </Button>
            </div>
          </div>
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
