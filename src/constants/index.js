export const CATEGORIES = [
	{ id: "news", label: "뉴스", emoji: "📰" },
	{ id: "tech", label: "기술", emoji: "💻" },
	{ id: "fashion", label: "패션", emoji: "👗" },
	{ id: "finance", label: "금융", emoji: "📈" },
	{ id: "health", label: "건강", emoji: "💪" },
	{ id: "food", label: "음식", emoji: "🍔" },
	{ id: "entertainment", label: "엔터테인먼트", emoji: "🎬" },
	{ id: "sports", label: "스포츠", emoji: "⚽" },
];

// Widget Classification (REQ-WS-002)
// Fixed Widgets: Non-draggable, positioned in Left/Right columns
// Standard Widgets: Draggable, Middle Column only
export const FIXED_WIDGETS = [
	{ id: "briefing", label: "AI 브리핑", zone: "left" },
	{ id: "diary", label: "오늘의 질문", zone: "left" },
	{ id: "calendar", label: "캘린더", zone: "right" },
	{ id: "todo", label: "할 일", zone: "right" },
];

export const STANDARD_WIDGETS = [
	{ id: "weather", label: "날씨", emoji: "🌤️" },
	{ id: "stocks", label: "주식/환율", emoji: "📈" },
	{ id: "trends", label: "실시간 트렌드", emoji: "🔥" },
	{ id: "health", label: "건강", emoji: "💪" },
	{ id: "news", label: "뉴스", emoji: "📰" },
	{ id: "smart", label: "스마트 위젯", emoji: "✨" },
];

// Default priority order for Standard Widgets (REQ-US-006)
export const DEFAULT_PRIORITY_ORDER = ["weather", "stocks", "trends", "health", "news", "smart"];

export const WIDGET_LIST = [
	{ id: "health", label: "건강 (Google Fit)", category: "core" },
	{ id: "calendar", label: "캘린더 (Google)", category: "core" },
	{ id: "briefing", label: "AI 브리핑", category: "core" },
	{ id: "trends", label: "실시간 트렌드", category: "core" },
	{ id: "stocks", label: "주식/환율", category: "core" },
	{ id: "weather", label: "날씨", category: "core" },
	{ id: "news", label: "뉴스", category: "core" },
];

export const DEFAULT_VIS = {
	health: true,
	briefing: true,
	trends: true,
	stocks: true,
	weather: true,
	calendar: true,
	news: true,
};

export const DEFAULT_LAYOUTS = {
	lg: [
		{ i: "briefing", x: 0, y: 0, w: 3, h: 14, minW: 2, minH: 6 },
		{ i: "calendar", x: 3, y: 0, w: 3, h: 14, minW: 2, minH: 6 },
		{ i: "weather", x: 6, y: 0, w: 3, h: 7, minW: 2, minH: 4 },
		{ i: "stocks", x: 9, y: 0, w: 3, h: 7, minW: 2, minH: 4 },
		{ i: "health", x: 6, y: 7, w: 3, h: 7, minW: 2, minH: 4 },
		{ i: "trends", x: 9, y: 7, w: 3, h: 7, minW: 2, minH: 4 },
	],
	md: [
		{ i: "briefing", x: 0, y: 0, w: 5, h: 14, minW: 2, minH: 6 },
		{ i: "calendar", x: 5, y: 0, w: 5, h: 14, minW: 2, minH: 6 },
		{ i: "weather", x: 0, y: 14, w: 5, h: 7, minW: 2, minH: 4 },
		{ i: "stocks", x: 5, y: 14, w: 5, h: 7, minW: 2, minH: 4 },
		{ i: "health", x: 0, y: 21, w: 5, h: 7, minW: 2, minH: 4 },
		{ i: "trends", x: 5, y: 21, w: 5, h: 7, minW: 2, minH: 4 },
	],
	sm: [
		{ i: "briefing", x: 0, y: 0, w: 6, h: 14, minW: 2, minH: 6 },
		{ i: "calendar", x: 0, y: 14, w: 6, h: 14, minW: 2, minH: 6 },
		{ i: "weather", x: 0, y: 28, w: 6, h: 7, minW: 2, minH: 4 },
		{ i: "stocks", x: 0, y: 35, w: 6, h: 7, minW: 2, minH: 4 },
		{ i: "health", x: 0, y: 42, w: 6, h: 7, minW: 2, minH: 4 },
		{ i: "trends", x: 0, y: 49, w: 6, h: 7, minW: 2, minH: 4 },
	],
};
