// Barrel: aiService was split into src/services/ai/* (BACKLOG I4). Public API unchanged.
export type { BriefingContext, SmartWidgetOpts, ArticleItem } from "./ai/types";
export { generatePersonalizedQuestion } from "./ai/dailyQuestion";
export { getTimeGreeting, generateDetailedBriefing } from "./ai/briefing";
export { SMART_WIDGET_CATEGORY_OPTIONS } from "./ai/smartWidgetConfig";
export { generateSmartWidgetData } from "./ai/smartWidget";
export { generateDiary, rewriteDiaryWithFeedback } from "./ai/diary";
