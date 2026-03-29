"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ARTICLE_LENGTH_OPTIONS,
  ARTICLE_TYPE_OPTIONS,
  BACKGROUND_OPTIONS,
  DIFFICULTY_OPTIONS,
  EXCLUDED_CONTENT_OPTIONS,
  INTEREST_OPTIONS,
  PURPOSE_OPTIONS,
  QUESTIONNAIRE_MAX_SELECTIONS,
  READING_TIME_OPTIONS,
  RECOMMENDATION_TYPE_OPTIONS,
  STYLE_OPTIONS,
  type QuestionnaireOption,
} from "@/app/onboarding/questionnaire/_constants/questionnaire";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildLoginPath, getSafeNextPath } from "@/lib/auth-entry";
import { getAuthToken, getUserProfile, normalizeUserUid, type UserProfile } from "@/services/auth";
import { submitOnboardingQuestionnaire } from "@/services/reco";

const OTHER_OPTION = "其他";

const selectionCountLabel = (count: number, maxCount: number) => `已选 ${count} / ${maxCount}`;

const resolveDashboardNextPath = (next?: string | null): string => {
  const safe = getSafeNextPath("user", next);
  return safe === "/dashboard" ? "/dashboard/recommend" : safe;
};

const toggleMultiSelect = (
  currentValues: string[],
  value: string,
  maxCount: number,
): { nextValues: string[]; exceeded: boolean } => {
  if (currentValues.includes(value)) {
    return {
      nextValues: currentValues.filter((item) => item !== value),
      exceeded: false,
    };
  }

  if (currentValues.length >= maxCount) {
    return { nextValues: currentValues, exceeded: true };
  }

  return {
    nextValues: [...currentValues, value],
    exceeded: false,
  };
};

const mergeSelectionsWithOther = (values: string[], otherValue: string): string[] => {
  const normalizedOtherValue = otherValue.trim();
  const nextValues = values.filter((item) => item !== OTHER_OPTION);
  if (values.includes(OTHER_OPTION) && normalizedOtherValue) {
    nextValues.push(normalizedOtherValue);
  }
  return nextValues;
};

const resolveSingleValueWithOther = (value: string, otherValue: string): string => {
  if (value !== OTHER_OPTION) {
    return value.trim();
  }
  return otherValue.trim();
};

function ChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function QuestionSection({
  index,
  title,
  description,
  helper,
  children,
}: {
  index: number;
  title: string;
  description: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{`${index}. ${title}`}</CardTitle>
        <CardDescription className="text-sm leading-6">{description}</CardDescription>
        {helper ? <p className="text-muted-foreground text-xs">{helper}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OptionGrid({
  options,
  selected,
  onToggle,
  columnsClassName = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
}: {
  options: QuestionnaireOption[];
  selected: string[];
  onToggle: (value: string) => void;
  columnsClassName?: string;
}) {
  return (
    <div className={`grid gap-3 ${columnsClassName}`}>
      {options.map((option) => (
        <ChoiceButton
          key={option.value}
          active={selected.includes(option.value)}
          label={option.label}
          onClick={() => onToggle(option.value)}
        />
      ))}
    </div>
  );
}

function OnboardingQuestionnairePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [interests, setInterests] = useState<string[]>([]);
  const [interestOther, setInterestOther] = useState("");
  const [purpose, setPurpose] = useState("");
  const [purposeOther, setPurposeOther] = useState("");
  const [articleTypes, setArticleTypes] = useState<string[]>([]);
  const [articleLength, setArticleLength] = useState("");
  const [style, setStyle] = useState("");
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [backgroundOther, setBackgroundOther] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [excludedContents, setExcludedContents] = useState<string[]>([]);
  const [excludedOther, setExcludedOther] = useState("");
  const [readingTimes, setReadingTimes] = useState<string[]>([]);
  const [recommendationTypes, setRecommendationTypes] = useState<string[]>([]);

  const nextPath = useMemo(
    () => resolveDashboardNextPath(searchParams.get("next")),
    [searchParams],
  );

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const token = getAuthToken();
      if (!token) {
        const currentPath =
          typeof window === "undefined"
            ? "/onboarding/questionnaire"
            : `${window.location.pathname}${window.location.search}`;
        router.replace(buildLoginPath({ role: "user", next: currentPath }));
        return;
      }

      try {
        const result = await getUserProfile(token);
        const foundUser = result?.found ? result.user : null;
        if (!cancelled) {
          if (!foundUser || !normalizeUserUid(foundUser.uid)) {
            setErrorMessage("当前登录状态缺少用户资料，请重新登录后再试。");
          } else {
            setProfile(foundUser);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "加载用户资料失败，请稍后重试。",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleMultiSelect = (
    value: string,
    values: string[],
    setter: (nextValues: string[]) => void,
    maxCount: number,
    fieldLabel: string,
  ) => {
    setErrorMessage(null);
    const result = toggleMultiSelect(values, value, maxCount);
    if (result.exceeded) {
      setErrorMessage(`${fieldLabel}最多选择 ${maxCount} 项。`);
      return;
    }
    setter(result.nextValues);
  };

  const validateBeforeSubmit = (): string | null => {
    if (!profile) {
      return "当前登录状态缺少用户资料，请重新登录后再试。";
    }
    if (interests.length === 0) {
      return "请先选择你最感兴趣的内容方向。";
    }
    if (interests.includes(OTHER_OPTION) && !interestOther.trim()) {
      return "请补充“其他兴趣方向”的具体内容。";
    }
    if (!purpose) {
      return "请选择你使用这个产品的主要目的。";
    }
    if (purpose === OTHER_OPTION && !purposeOther.trim()) {
      return "请补充“其他使用目的”的具体内容。";
    }
    if (articleTypes.length === 0) {
      return "请至少选择一种喜欢的文章类型。";
    }
    if (!articleLength) {
      return "请选择你通常喜欢的文章长度。";
    }
    if (!style) {
      return "请选择你偏好的内容风格。";
    }
    if (backgrounds.length === 0) {
      return "请至少选择一个专业背景或熟悉领域。";
    }
    if (backgrounds.includes(OTHER_OPTION) && !backgroundOther.trim()) {
      return "请补充“其他专业背景”的具体内容。";
    }
    if (!difficulty) {
      return "请选择你对内容难度的偏好。";
    }
    if (excludedContents.includes(OTHER_OPTION) && !excludedOther.trim()) {
      return "请补充“不想看到的其他内容”。";
    }
    if (recommendationTypes.length === 0) {
      return "请至少选择一种愿意接收的个性化推荐方式。";
    }
    return null;
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    const validationMessage = validateBeforeSubmit();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }
    if (!profile) {
      setErrorMessage("当前登录状态缺少用户资料，请重新登录后再试。");
      return;
    }

    setSubmitting(true);
    try {
      await submitOnboardingQuestionnaire({
        user_id: normalizeUserUid(profile.uid),
        username: profile.username?.trim() || undefined,
        interests: mergeSelectionsWithOther(interests, interestOther),
        primary_purpose: resolveSingleValueWithOther(purpose, purposeOther),
        preferred_article_types: articleTypes,
        preferred_article_length: articleLength,
        preferred_style: style,
        backgrounds: mergeSelectionsWithOther(backgrounds, backgroundOther),
        difficulty_preference: difficulty,
        excluded_contents: mergeSelectionsWithOther(excludedContents, excludedOther),
        reading_time_slots: readingTimes,
        personalized_recommendation_types: recommendationTypes,
      });

      router.replace(nextPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "提交问卷失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <Layout>
        <PageContainer className="py-10">
          <Card className="mx-auto max-w-3xl">
            <CardContent className="text-muted-foreground py-16 text-center text-sm">
              正在加载你的注册问卷...
            </CardContent>
          </Card>
        </PageContainer>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageContainer className="py-8 sm:py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_58%,#93c5fd_100%)] text-white shadow-xl">
            <CardContent className="flex flex-col gap-5 px-6 py-8 sm:px-8">
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-[0.28em] text-white/75 uppercase">
                  冷启动偏好问卷
                </p>
                <h1 className="text-3xl font-semibold sm:text-4xl">先告诉我你想看什么</h1>
                <p className="max-w-3xl text-sm leading-7 text-white/80 sm:text-base">
                  这份问卷只需要 1 到 2
                  分钟。提交后，我们会把它写入推荐系统，作为你的初始推荐记忆，帮助首页更快给出贴近兴趣的内容。
                </p>
              </div>
              <div className="grid gap-3 text-sm text-white/85 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3">
                  当前账号：{profile?.username || "未命名用户"}
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3">
                  用户 ID：{normalizeUserUid(profile?.uid)}
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3">
                  完成后将跳转到：{nextPath}
                </div>
              </div>
            </CardContent>
          </Card>

          {errorMessage ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="text-destructive py-4 text-sm">{errorMessage}</CardContent>
            </Card>
          ) : null}

          <QuestionSection
            index={1}
            title="你最感兴趣的内容方向是什么？"
            description="多选，最多 5 个。这个答案会成为最基础的主题偏好。"
            helper={selectionCountLabel(interests.length, QUESTIONNAIRE_MAX_SELECTIONS.interests)}
          >
            <OptionGrid
              options={INTEREST_OPTIONS}
              selected={interests}
              onToggle={(value) =>
                handleMultiSelect(
                  value,
                  interests,
                  setInterests,
                  QUESTIONNAIRE_MAX_SELECTIONS.interests,
                  "内容方向",
                )
              }
            />
            {interests.includes(OTHER_OPTION) ? (
              <div className="mt-4 grid gap-2">
                <Label htmlFor="interest-other">其他兴趣方向</Label>
                <Input
                  id="interest-other"
                  value={interestOther}
                  onChange={(event) => setInterestOther(event.target.value)}
                  placeholder="补充一个你更想看的主题"
                />
              </div>
            ) : null}
          </QuestionSection>

          <QuestionSection
            index={2}
            title="你使用这个产品的主要目的是什么？"
            description="单选。这个答案会帮助我们区分学习型、资讯型和娱乐型的推荐目标。"
          >
            <OptionGrid
              options={PURPOSE_OPTIONS}
              selected={purpose ? [purpose] : []}
              onToggle={(value) => {
                setErrorMessage(null);
                setPurpose((current) => (current === value ? "" : value));
              }}
            />
            {purpose === OTHER_OPTION ? (
              <div className="mt-4 grid gap-2">
                <Label htmlFor="purpose-other">其他使用目的</Label>
                <Input
                  id="purpose-other"
                  value={purposeOther}
                  onChange={(event) => setPurposeOther(event.target.value)}
                  placeholder="例如：找灵感、做研究、跟进某个细分行业"
                />
              </div>
            ) : null}
          </QuestionSection>

          <QuestionSection
            index={3}
            title="你更喜欢哪种文章类型？"
            description="多选，最多 3 个。它会影响推荐结果的内容形式，而不只是主题。"
            helper={selectionCountLabel(
              articleTypes.length,
              QUESTIONNAIRE_MAX_SELECTIONS.articleTypes,
            )}
          >
            <OptionGrid
              options={ARTICLE_TYPE_OPTIONS}
              selected={articleTypes}
              onToggle={(value) =>
                handleMultiSelect(
                  value,
                  articleTypes,
                  setArticleTypes,
                  QUESTIONNAIRE_MAX_SELECTIONS.articleTypes,
                  "文章类型",
                )
              }
            />
          </QuestionSection>

          <QuestionSection
            index={4}
            title="你通常喜欢多长的文章？"
            description="单选。这个答案会帮助我们控制推荐长度，提升阅读完成率。"
          >
            <OptionGrid
              options={ARTICLE_LENGTH_OPTIONS}
              selected={articleLength ? [articleLength] : []}
              onToggle={(value) => {
                setErrorMessage(null);
                setArticleLength((current) => (current === value ? "" : value));
              }}
            />
          </QuestionSection>

          <QuestionSection
            index={5}
            title="你希望推荐内容更偏向哪种风格？"
            description="单选。它会帮助我们更快匹配你能读下去的表达方式。"
          >
            <OptionGrid
              options={STYLE_OPTIONS}
              selected={style ? [style] : []}
              onToggle={(value) => {
                setErrorMessage(null);
                setStyle((current) => (current === value ? "" : value));
              }}
            />
          </QuestionSection>

          <QuestionSection
            index={6}
            title="你的专业背景或熟悉领域是什么？"
            description="多选，最多 4 个。它会帮助我们估计内容难度和行业相关性。"
            helper={selectionCountLabel(
              backgrounds.length,
              QUESTIONNAIRE_MAX_SELECTIONS.backgrounds,
            )}
          >
            <OptionGrid
              options={BACKGROUND_OPTIONS}
              selected={backgrounds}
              onToggle={(value) =>
                handleMultiSelect(
                  value,
                  backgrounds,
                  setBackgrounds,
                  QUESTIONNAIRE_MAX_SELECTIONS.backgrounds,
                  "专业背景",
                )
              }
            />
            {backgrounds.includes(OTHER_OPTION) ? (
              <div className="mt-4 grid gap-2">
                <Label htmlFor="background-other">其他背景</Label>
                <Input
                  id="background-other"
                  value={backgroundOther}
                  onChange={(event) => setBackgroundOther(event.target.value)}
                  placeholder="补充一个你熟悉的行业或身份"
                />
              </div>
            ) : null}
          </QuestionSection>

          <QuestionSection
            index={7}
            title="你对内容难度的偏好是？"
            description="单选。这个答案可以避免新用户一开始被太难或太浅的内容劝退。"
          >
            <OptionGrid
              options={DIFFICULTY_OPTIONS}
              selected={difficulty ? [difficulty] : []}
              onToggle={(value) => {
                setErrorMessage(null);
                setDifficulty((current) => (current === value ? "" : value));
              }}
            />
          </QuestionSection>

          <QuestionSection
            index={8}
            title="哪些内容你不想看到？"
            description="多选，可跳过。负反馈通常比正反馈更能帮助推荐快速收敛。"
            helper={selectionCountLabel(
              excludedContents.length,
              QUESTIONNAIRE_MAX_SELECTIONS.excludedContents,
            )}
          >
            <OptionGrid
              options={EXCLUDED_CONTENT_OPTIONS}
              selected={excludedContents}
              onToggle={(value) =>
                handleMultiSelect(
                  value,
                  excludedContents,
                  setExcludedContents,
                  QUESTIONNAIRE_MAX_SELECTIONS.excludedContents,
                  "不想看到的内容",
                )
              }
            />
            {excludedContents.includes(OTHER_OPTION) ? (
              <div className="mt-4 grid gap-2">
                <Label htmlFor="excluded-other">其他不想看到的内容</Label>
                <Input
                  id="excluded-other"
                  value={excludedOther}
                  onChange={(event) => setExcludedOther(event.target.value)}
                  placeholder="补充你想过滤掉的主题"
                />
              </div>
            ) : null}
          </QuestionSection>

          <QuestionSection
            index={9}
            title="你更常在什么时间阅读？"
            description="多选，可跳过。这个答案会帮助我们匹配推荐节奏和内容长度。"
            helper={selectionCountLabel(
              readingTimes.length,
              QUESTIONNAIRE_MAX_SELECTIONS.readingTimes,
            )}
          >
            <OptionGrid
              options={READING_TIME_OPTIONS}
              selected={readingTimes}
              onToggle={(value) =>
                handleMultiSelect(
                  value,
                  readingTimes,
                  setReadingTimes,
                  QUESTIONNAIRE_MAX_SELECTIONS.readingTimes,
                  "阅读时间",
                )
              }
            />
          </QuestionSection>

          <QuestionSection
            index={10}
            title="你是否愿意接收以下类型的个性化推荐？"
            description="多选。这个答案会同时服务首页推荐和后续通知分流。"
            helper={selectionCountLabel(
              recommendationTypes.length,
              QUESTIONNAIRE_MAX_SELECTIONS.recommendationTypes,
            )}
          >
            <OptionGrid
              options={RECOMMENDATION_TYPE_OPTIONS}
              selected={recommendationTypes}
              onToggle={(value) =>
                handleMultiSelect(
                  value,
                  recommendationTypes,
                  setRecommendationTypes,
                  QUESTIONNAIRE_MAX_SELECTIONS.recommendationTypes,
                  "个性化推荐方式",
                )
              }
            />
          </QuestionSection>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">准备好了就提交</h2>
                <p className="text-muted-foreground text-sm leading-6">
                  提交后会立即写入推荐系统，作为你的初始推荐记忆。随后会直接跳转到首页推荐流。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:w-auto sm:min-w-[220px]">
                <Button onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? "正在写入推荐记忆..." : "提交问卷并进入推荐页"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.replace(nextPath)}
                  disabled={submitting}
                >
                  稍后再填写
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </Layout>
  );
}

export default function OnboardingQuestionnairePage() {
  return (
    <Suspense fallback={null}>
      <OnboardingQuestionnairePageContent />
    </Suspense>
  );
}
