export const CATEGORIES = [
	{ id: "news", label: "News", emoji: "📰" },
	{ id: "tech", label: "Tech", emoji: "💻" },
	{ id: "fashion", label: "Fashion", emoji: "👗" },
	{ id: "finance", label: "Finance", emoji: "📈" },
	{ id: "health", label: "Health", emoji: "💪" },
	{ id: "food", label: "Food", emoji: "🍔" },
	{ id: "entertainment", label: "Entertainment", emoji: "🎬" },
	{ id: "sports", label: "Sports", emoji: "⚽" },
];

// Widget Classification (REQ-WS-002)
// Fixed Widgets: Non-draggable, positioned in Left/Right columns
// Standard Widgets: Draggable, Middle Column only
export const FIXED_WIDGETS = [
	{ id: "briefing", label: "AI Briefing", zone: "left" },
	{ id: "diary", label: "Daily Question", zone: "left" },
	{ id: "calendar", label: "Calendar", zone: "right" },
	{ id: "todo", label: "Tasks", zone: "right" },
];

export const STANDARD_WIDGETS = [
	{ id: "weather", label: "Weather", emoji: "🌤️" },
	{ id: "stocks", label: "Stocks/Exchange", emoji: "📈" },
	{ id: "trends", label: "Live Trends", emoji: "🔥" },
	{ id: "health", label: "Health", emoji: "💪" },
	{ id: "news", label: "News", emoji: "📰" },
	{ id: "smart", label: "Smart Widget", emoji: "✨" },
];

// Default priority order for Standard Widgets (REQ-US-006)
// Note: smart widgets are user-defined and appended dynamically; "smart" is not included here
export const DEFAULT_PRIORITY_ORDER = ["weather", "stocks", "trends", "health", "news"];

export const WIDGET_LIST = [
	{ id: "health", label: "Health (Google Fit)", category: "core" },
	{ id: "calendar", label: "Calendar (Google)", category: "core" },
	{ id: "briefing", label: "AI Briefing", category: "core" },
	{ id: "trends", label: "Live Trends", category: "core" },
	{ id: "stocks", label: "Stocks/Exchange", category: "core" },
	{ id: "weather", label: "Weather", category: "core" },
	{ id: "news", label: "News", category: "core" },
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
