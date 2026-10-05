import type {
	WeatherData,
	StockItem,
	CalEvent,
	HealthData,
	TodoItem,
	PersonaContext,
	Interest,
	SmartWidgetSummary,
} from "../../types/index";

// ── Local interface definitions ──────────────────────────────
export interface ArticleItem {
	title?: string;
	url?: string;
	content?: string;
	source?: string;
	published_date?: string | null;
	image?: string | null;
}

export type SmartResult = ArticleItem & { score?: number };

export interface BriefingContext {
	weather?: WeatherData | null;
	stocks?: StockItem[];
	trends?: string[];
	trendsResults?: ArticleItem[];
	newsResults?: ArticleItem[];
	newsAnswer?: string | null;
	calEvents?: CalEvent[];
	tomorrowEvents?: CalEvent[];
	healthData?: HealthData | null;
	todos?: TodoItem[];
	activeWidgetIds?: string[];
	persona?: string | PersonaContext | null;
	yesterdayDiary?: string | null;
	yesterdayMemo?: string | null;
	smartSummaries?: SmartWidgetSummary[];
	keywordInterests?: Interest[];
}

export interface SmartWidgetOpts {
	persona?: PersonaContext | null;
	token?: string | null;
	categoryOverride?: string | null;
}

export interface LangConfig {
	lang: string;
	langInstruction: string;
	noneLabel: string;
}

export interface SmartSectionPlan {
	id?: string;
	title?: string;
	type?: string;
	category?: string;
	searchMode?: string;
	query?: string;
	keyword?: string;
	maxItems?: number;
	allowMixed?: boolean;
	linkOnly?: boolean;
	[key: string]: unknown;
}
