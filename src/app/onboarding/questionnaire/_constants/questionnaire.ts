export interface QuestionnaireOption {
  value: string;
  label: string;
}

export const QUESTIONNAIRE_MAX_SELECTIONS = {
  interests: 5,
  articleTypes: 3,
  backgrounds: 4,
  excludedContents: 5,
  readingTimes: 4,
  recommendationTypes: 4,
} as const;

export const INTEREST_OPTIONS: QuestionnaireOption[] = [
  { value: "科技", label: "科技" },
  { value: "商业 / 创业", label: "商业 / 创业" },
  { value: "财经 / 投资", label: "财经 / 投资" },
  { value: "职场 / 管理", label: "职场 / 管理" },
  { value: "教育 / 学习", label: "教育 / 学习" },
  { value: "心理 / 情感", label: "心理 / 情感" },
  { value: "健康 / 运动", label: "健康 / 运动" },
  { value: "时事 / 新闻", label: "时事 / 新闻" },
  { value: "娱乐 / 影视", label: "娱乐 / 影视" },
  { value: "游戏", label: "游戏" },
  { value: "体育", label: "体育" },
  { value: "旅行", label: "旅行" },
  { value: "美食", label: "美食" },
  { value: "历史 / 人文", label: "历史 / 人文" },
  { value: "小说 / 故事", label: "小说 / 故事" },
  { value: "设计 / 艺术", label: "设计 / 艺术" },
  { value: "时尚 / 生活方式", label: "时尚 / 生活方式" },
  { value: "母婴 / 家庭", label: "母婴 / 家庭" },
  { value: "汽车", label: "汽车" },
  { value: "其他", label: "其他" },
];

export const PURPOSE_OPTIONS: QuestionnaireOption[] = [
  { value: "获取行业资讯", label: "获取行业资讯" },
  { value: "学习新知识", label: "学习新知识" },
  { value: "提升工作能力", label: "提升工作能力" },
  { value: "打发碎片时间", label: "打发碎片时间" },
  { value: "关注热点新闻", label: "关注热点新闻" },
  { value: "获取专业深度内容", label: "获取专业深度内容" },
  { value: "寻找轻松娱乐内容", label: "寻找轻松娱乐内容" },
  { value: "其他", label: "其他" },
];

export const ARTICLE_TYPE_OPTIONS: QuestionnaireOption[] = [
  { value: "资讯快讯", label: "资讯快讯" },
  { value: "深度分析", label: "深度分析" },
  { value: "实用教程 / 干货", label: "实用教程 / 干货" },
  { value: "观点评论", label: "观点评论" },
  { value: "案例拆解", label: "案例拆解" },
  { value: "榜单 / 推荐", label: "榜单 / 推荐" },
  { value: "专访 / 人物故事", label: "专访 / 人物故事" },
  { value: "科普解读", label: "科普解读" },
  { value: "故事 / 随笔", label: "故事 / 随笔" },
  { value: "数据报告 / 趋势洞察", label: "数据报告 / 趋势洞察" },
];

export const ARTICLE_LENGTH_OPTIONS: QuestionnaireOption[] = [
  { value: "3 分钟以内，快速浏览", label: "3 分钟以内，快速浏览" },
  { value: "3～5 分钟，中等长度", label: "3～5 分钟，中等长度" },
  { value: "5～10 分钟，愿意认真读", label: "5～10 分钟，愿意认真读" },
  { value: "10 分钟以上，偏好深度内容", label: "10 分钟以上，偏好深度内容" },
  { value: "都可以", label: "都可以" },
];

export const STYLE_OPTIONS: QuestionnaireOption[] = [
  { value: "轻松有趣", label: "轻松有趣" },
  { value: "简洁直接", label: "简洁直接" },
  { value: "专业严谨", label: "专业严谨" },
  { value: "深度思考型", label: "深度思考型" },
  { value: "情绪共鸣型", label: "情绪共鸣型" },
  { value: "客观中立", label: "客观中立" },
  { value: "都可以", label: "都可以" },
];

export const BACKGROUND_OPTIONS: QuestionnaireOption[] = [
  { value: "学生", label: "学生" },
  { value: "互联网 / 科技", label: "互联网 / 科技" },
  { value: "金融 / 投资", label: "金融 / 投资" },
  { value: "市场 / 运营", label: "市场 / 运营" },
  { value: "销售 / 商务", label: "销售 / 商务" },
  { value: "产品 / 设计", label: "产品 / 设计" },
  { value: "教育 / 培训", label: "教育 / 培训" },
  { value: "医疗 / 健康", label: "医疗 / 健康" },
  { value: "制造 / 工程", label: "制造 / 工程" },
  { value: "自由职业", label: "自由职业" },
  { value: "创业者", label: "创业者" },
  { value: "其他", label: "其他" },
];

export const DIFFICULTY_OPTIONS: QuestionnaireOption[] = [
  { value: "入门易懂", label: "入门易懂" },
  { value: "中等，有一定信息量", label: "中等，有一定信息量" },
  { value: "专业深入", label: "专业深入" },
  { value: "根据主题自动调整", label: "根据主题自动调整" },
];

export const EXCLUDED_CONTENT_OPTIONS: QuestionnaireOption[] = [
  { value: "娱乐八卦", label: "娱乐八卦" },
  { value: "广告软文", label: "广告软文" },
  { value: "负面社会新闻", label: "负面社会新闻" },
  { value: "争议性观点", label: "争议性观点" },
  { value: "投资 / 理财", label: "投资 / 理财" },
  { value: "情感鸡汤", label: "情感鸡汤" },
  { value: "长篇深度文", label: "长篇深度文" },
  { value: "短资讯快讯", label: "短资讯快讯" },
  { value: "重复热点", label: "重复热点" },
  { value: "其他", label: "其他" },
];

export const READING_TIME_OPTIONS: QuestionnaireOption[] = [
  { value: "早上起床后", label: "早上起床后" },
  { value: "通勤路上", label: "通勤路上" },
  { value: "午休时间", label: "午休时间" },
  { value: "下班后", label: "下班后" },
  { value: "晚上睡前", label: "晚上睡前" },
  { value: "周末", label: "周末" },
  { value: "时间不固定", label: "时间不固定" },
];

export const RECOMMENDATION_TYPE_OPTIONS: QuestionnaireOption[] = [
  { value: "每日精选", label: "每日精选" },
  { value: "热门趋势", label: "热门趋势" },
  { value: "与我兴趣相关的新内容", label: "与我兴趣相关的新内容" },
  { value: "深度专题合集", label: "深度专题合集" },
  { value: "相似文章推荐", label: "相似文章推荐" },
  { value: "不需要通知，只在首页推荐", label: "不需要通知，只在首页推荐" },
];
