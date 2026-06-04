// ── Layout ────────────────────────────────────────────────────
export interface LayoutItem {
	i: string;
	x: number;
	y: number;
	w: number;
	h: number;
	minW?: number;
	minH?: number;
	static?: boolean;
}

export type Layouts = Record<string, LayoutItem[]>;

// ── Visibility ────────────────────────────────────────────────
export type VisMap = Record<string, boolean>;

// ── User / Auth ───────────────────────────────────────────────
export interface AppUser {
	id: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
}

export interface Perms {
	fit: boolean;
	cal: boolean;
}

// ── Weather ───────────────────────────────────────────────────
export interface WeatherData {
	city?: string;
	temp?: number;
	condition?: string;
	conditionId?: number;
	precipitation?: number;
	icon?: string;
	humidity?: number;
	windSpeed?: number;
	feelsLike?: number;
}

// ── Stocks ────────────────────────────────────────────────────
export interface StockItem {
	name: string;
	symbol?: string;
	value: string | number;
	change: string | number;
	changePercent?: string | number;
}

// ── Calendar ──────────────────────────────────────────────────
export interface CalEvent {
	id?: string;
	title?: string;
	summary?: string;
	start: string;
	end?: string;
	location?: string;
	description?: string;
}

// ── Todo ──────────────────────────────────────────────────────
export interface TodoItem {
	id: string;
	text: string;
	completed: boolean;
	dueDate?: string | null;
	recurrence?: string | null;
}

// ── Diary ─────────────────────────────────────────────────────
export interface DiaryEntry {
	date: string;
	question?: string;
	answer?: string;
	memo?: string;
	generatedDiary?: string;
}

// ── Interest / Persona ────────────────────────────────────────
export interface Interest {
	id?: string;
	keyword: string;
	label?: string;
	category?: string;
	score?: number;
	source?: string;
	fixed?: boolean;
}

export interface PersonaContext {
	persona: string | null;
	age: number | string | null;
	interests: string[];
	job: string | null;
	memo: string;
}

// ── News / Trends ─────────────────────────────────────────────
export interface NewsArticle {
	title?: string;
	url?: string;
	content?: string;
	source?: string;
	publishedAt?: string;
	published_date?: string;
}

export interface TrendItem {
	title?: string;
	url?: string;
	query?: string;
}

// ── Smart Widget ──────────────────────────────────────────────
export interface SmartSectionLine {
	title: string;
	url: string;
	source?: string;
	summary?: string;
	keyword?: string;
}

export type SmartSectionLineOrString = SmartSectionLine | string;

export interface SmartSubBlock {
	id: string;
	title: string;
	lines: SmartSectionLineOrString[];
}

export interface SmartSection {
	id: string;
	title: string;
	lines: SmartSectionLineOrString[];
	subBlocks?: SmartSubBlock[];
	type?: string;
	bullets?: string[];
	items?: Record<string, unknown>[];
	tags?: string[];
}

export interface SmartWidgetSummary {
	keyword: string;
	bullets: string[];
	latestArticle?: { title: string; url: string; source?: string } | null;
}

export interface SmartWidgetData {
	keyword?: string;
	summary?: string;
	detail?: string;
	sections?: SmartSection[];
	bullets?: string[];
	latestArticle?: { title: string; url: string; source?: string } | null;
	emoji?: string;
	category?: string;
	categoryLabel?: string;
	lastUpdated?: string;
	lastUpdatedAt?: string;
}

// ── Briefing ──────────────────────────────────────────────────
export interface BriefingSection {
	id: string;
	title: string;
	lines: SmartSectionLineOrString[];
	subBlocks?: SmartSubBlock[];
}

export interface BriefingResult {
	summary: string;
	detail: string;
	sections: BriefingSection[];
	timeMode: string;
}

// ── Widget settings ───────────────────────────────────────────
export interface WidgetSetting {
	viewType?: string;
	interestsEnabled?: boolean;
	[key: string]: unknown;
}

export type WidgetSettings = Record<string, WidgetSetting>;

// ── Quick links ───────────────────────────────────────────────
export interface QuickLink {
	id: string;
	label: string;
	url: string;
	icon?: string;
}

// ── Health ────────────────────────────────────────────────────
export interface HealthData {
	steps?: number;
	calories?: number;
	heartRate?: number;
	sleep?: number;
	distance?: number;
}

// ── Onboarding profile ────────────────────────────────────────
export interface OnboardingProfile {
	persona?: string;
	age?: number | string;
	interests?: string[];
}
