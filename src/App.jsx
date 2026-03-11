import React, { useState, useEffect, useRef, useMemo } from "react";
import { ResponsiveGridLayout } from "react-grid-layout";
import {
	Search,
	Settings,
	Sun,
	Moon,
	TrendingUp,
	CheckCircle2,
	User,
	Plus,
	X,
	Calendar,
	ShoppingBag,
	Volume2,
	VolumeX,
	MapPin,
	Image,
	Star,
	Activity,
	LogOut,
	RefreshCw,
	Sparkles,
	GripVertical,
	Lock,
	Unlock,
} from "lucide-react";
import {
	mockBookmarks,
	fetchWeather,
	fetchStocks,
	fetchTrends,
	mockTodos,
	fetchCalendarEvents,
	fetchHealthData,
	mockBrandDrops,
	mockFoods,
	mockRestaurants,
	mockBriefings,
	mockSmartWidgets,
} from "./mock/data";

/* ── localStorage helpers ── */
const load = (k, fb) => {
	try {
		const v = localStorage.getItem(k);
		return v !== null ? JSON.parse(v) : fb;
	} catch {
		return fb;
	}
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ── constants ── */
const CATEGORIES = [
	{ id: "news", label: "뉴스", emoji: "📰" },
	{ id: "tech", label: "기술", emoji: "💻" },
	{ id: "fashion", label: "패션", emoji: "👗" },
	{ id: "finance", label: "금융", emoji: "📈" },
	{ id: "health", label: "건강", emoji: "💪" },
	{ id: "food", label: "음식", emoji: "🍔" },
	{ id: "entertainment", label: "엔터테인먼트", emoji: "🎬" },
	{ id: "sports", label: "스포츠", emoji: "⚽" },
];

const WIDGET_LIST = [
	{ id: "health", label: "건강 (Google Fit)", category: "core" },
	{ id: "calendar", label: "캘린더 (Google)", category: "core" },
	{ id: "todo", label: "오늘의 할 일", category: "core" },
	{ id: "briefing", label: "AI 브리핑", category: "core" },
	{ id: "trends", label: "실시간 트렌드", category: "core" },
	{ id: "stocks", label: "주식/환율", category: "core" },
	{ id: "weather", label: "날씨", category: "core" },
	{ id: "foodRoulette", label: "메뉴 결정 도우미", category: "smart" },
	{ id: "brandDrop", label: "브랜드 Drop D-Day", category: "smart" },
	{ id: "restaurants", label: "주변 맛집", category: "smart" },
];

const DEFAULT_VIS = {
	todo: true,
	health: true,
	briefing: true,
	trends: true,
	foodRoulette: true,
	stocks: true,
	weather: true,
	brandDrop: true,
	calendar: true,
	restaurants: false,
};

/* Default grid layout — 12 columns, rowHeight=30 */
const DEFAULT_LAYOUTS = {
	lg: [
		/* Col 1 (x:0) */
		{ i: "health", x: 0, y: 0, w: 3, h: 10, minW: 2, minH: 6 },
		{ i: "calendar", x: 0, y: 10, w: 3, h: 8, minW: 2, minH: 5 },
		{ i: "todo", x: 0, y: 18, w: 3, h: 8, minW: 2, minH: 5 },
		/* Col 2 (x:3) */
		{ i: "briefing", x: 3, y: 0, w: 3, h: 9, minW: 2, minH: 6 },
		{ i: "trends", x: 3, y: 9, w: 3, h: 5, minW: 2, minH: 3 },
		{ i: "foodRoulette", x: 3, y: 14, w: 3, h: 7, minW: 2, minH: 4 },
		/* Col 3 (x:6) */
		{ i: "stocks", x: 6, y: 0, w: 3, h: 9, minW: 2, minH: 5 },
		{ i: "weather", x: 6, y: 9, w: 3, h: 5, minW: 2, minH: 3 },
		{ i: "brandDrop", x: 6, y: 14, w: 3, h: 9, minW: 2, minH: 5 },
		{ i: "restaurants", x: 6, y: 23, w: 3, h: 8, minW: 2, minH: 5 },
		/* Col 4 (x:9) */
		{ i: "smart_카메라", x: 9, y: 0, w: 3, h: 12, minW: 2, minH: 6 },
		{ i: "smart_노트북", x: 9, y: 12, w: 3, h: 12, minW: 2, minH: 6 },
		{ i: "addSmart", x: 9, y: 24, w: 3, h: 2, minW: 2, minH: 2, static: true },
	],
	md: [
		{ i: "health", x: 0, y: 0, w: 5, h: 10, minW: 3, minH: 6 },
		{ i: "calendar", x: 0, y: 10, w: 5, h: 8, minW: 3, minH: 5 },
		{ i: "todo", x: 0, y: 18, w: 5, h: 8, minW: 3, minH: 5 },
		{ i: "briefing", x: 5, y: 0, w: 5, h: 9, minW: 3, minH: 6 },
		{ i: "trends", x: 5, y: 9, w: 5, h: 5, minW: 3, minH: 3 },
		{ i: "stocks", x: 5, y: 14, w: 5, h: 9, minW: 3, minH: 5 },
		{ i: "weather", x: 0, y: 26, w: 5, h: 5, minW: 3, minH: 3 },
		{ i: "foodRoulette", x: 5, y: 23, w: 5, h: 7, minW: 3, minH: 4 },
		{ i: "brandDrop", x: 0, y: 31, w: 5, h: 9, minW: 3, minH: 5 },
		{ i: "restaurants", x: 5, y: 30, w: 5, h: 8, minW: 3, minH: 5 },
		{ i: "smart_카메라", x: 0, y: 40, w: 5, h: 12, minW: 3, minH: 6 },
		{ i: "smart_노트북", x: 5, y: 40, w: 5, h: 12, minW: 3, minH: 6 },
		{ i: "addSmart", x: 0, y: 52, w: 10, h: 2, minW: 3, minH: 2, static: true },
	],
	sm: [
		{ i: "health", x: 0, y: 0, w: 6, h: 10, minW: 4, minH: 6 },
		{ i: "calendar", x: 0, y: 10, w: 6, h: 8, minW: 4, minH: 5 },
		{ i: "briefing", x: 0, y: 18, w: 6, h: 9, minW: 4, minH: 6 },
		{ i: "todo", x: 0, y: 27, w: 6, h: 8, minW: 4, minH: 5 },
		{ i: "trends", x: 0, y: 35, w: 6, h: 5, minW: 4, minH: 3 },
		{ i: "stocks", x: 0, y: 40, w: 6, h: 9, minW: 4, minH: 5 },
		{ i: "weather", x: 0, y: 49, w: 6, h: 5, minW: 4, minH: 3 },
		{ i: "foodRoulette", x: 0, y: 54, w: 6, h: 7, minW: 4, minH: 4 },
		{ i: "brandDrop", x: 0, y: 61, w: 6, h: 9, minW: 4, minH: 5 },
		{ i: "restaurants", x: 0, y: 70, w: 6, h: 8, minW: 4, minH: 5 },
		{ i: "smart_카메라", x: 0, y: 78, w: 6, h: 12, minW: 4, minH: 6 },
		{ i: "smart_노트북", x: 0, y: 90, w: 6, h: 12, minW: 4, minH: 6 },
		{ i: "addSmart", x: 0, y: 102, w: 6, h: 2, minW: 4, minH: 2, static: true },
	],
};

/* ════════════════════════════════════════════════ */

const App = () => {
	/* ── Auth / Onboarding ── */
	const [isLoggedIn, setIsLoggedIn] = useState(() => load("mb_login", false));
	const [onboarded, setOnboarded] = useState(() => load("mb_onboarded", false));
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [obStep, setObStep] = useState(0);
	const [selCats, setSelCats] = useState(() => load("mb_cats", []));
	const [perms, setPerms] = useState(() =>
		load("mb_perms", { fit: false, cal: false }),
	);

	/* ── Core ── */
	const [currentTime, setCurrentTime] = useState(new Date());
	const [todo, setTodo] = useState(() => load("mb_todos", mockTodos));
	const [newTodoText, setNewTodoText] = useState("");
	const [showAddTodo, setShowAddTodo] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	/* ── Data ── */
	const [weather, setWeather] = useState(null);
	const [stocks, setStocks] = useState([]);
	const [trends, setTrends] = useState([]);
	const [calEvents, setCalEvents] = useState([]);
	const [healthData, setHealthData] = useState(null);

	/* ── UI ── */
	const [showSettings, setShowSettings] = useState(false);
	const [settingsTab, setSettingsTab] = useState("widgets");
	const [showBriefSettings, setShowBriefSettings] = useState(false);
	const [theme, setTheme] = useState(() => load("mb_theme", "dark"));
	const [bgImage, setBgImage] = useState(() => load("mb_bg", null));
	const [vis, setVis] = useState(() => load("mb_vis", DEFAULT_VIS));

	/* ── Briefing ── */
	const [tone, setTone] = useState(() => load("mb_tone", "friendly"));
	const [bLen, setBLen] = useState(() => load("mb_blen", "medium"));
	const [voiceOn, setVoiceOn] = useState(() => load("mb_voice", false));
	const [speaking, setSpeaking] = useState(false);

	/* ── Food Roulette ── */
	const [rouletteResult, setRouletteResult] = useState(null);
	const [spinning, setSpinning] = useState(false);

	/* ── Smart Widgets ── */
	const [smartKeywords, setSmartKeywords] = useState(() =>
		load("mb_smart", ["카메라", "노트북"]),
	);
	const [showAddSmart, setShowAddSmart] = useState(false);
	const [newKeyword, setNewKeyword] = useState("");
	const [refreshing, setRefreshing] = useState({});

	/* ── Grid Layout ── */
	const [layouts, setLayouts] = useState(() => {
		const LAYOUT_VERSION = 2; // bump to force 4-col reset
		const savedVer = load("mb_layout_ver", 0);
		if (savedVer < LAYOUT_VERSION) {
			save("mb_layout_ver", LAYOUT_VERSION);
			save("mb_layouts", DEFAULT_LAYOUTS);
			return DEFAULT_LAYOUTS;
		}
		return load("mb_layouts", DEFAULT_LAYOUTS);
	});
	const [editMode, setEditMode] = useState(false);

	const bgRef = useRef(null);
	const gridContainerRef = useRef(null);
	const [gridWidth, setGridWidth] = useState(0);

	/* Measure grid container width */
	useEffect(() => {
		const el = gridContainerRef.current;
		if (!el) return;
		const measure = () => setGridWidth(el.offsetWidth);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [isLoggedIn]);

	/* ═══════════ Effects ═══════════ */
	useEffect(() => {
		const t = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	useEffect(() => {
		if (!isLoggedIn) return;
		fetchWeather().then(setWeather);
		fetchStocks().then(setStocks);
		fetchTrends().then(setTrends);
		fetchCalendarEvents().then(setCalEvents);
		fetchHealthData().then(setHealthData);
	}, [isLoggedIn]);

	useEffect(() => {
		if (isLoggedIn && !onboarded) setShowOnboarding(true);
	}, [isLoggedIn, onboarded]);

	useEffect(() => save("mb_todos", todo), [todo]);
	useEffect(() => save("mb_vis", vis), [vis]);
	useEffect(() => save("mb_theme", theme), [theme]);
	useEffect(() => save("mb_tone", tone), [tone]);
	useEffect(() => save("mb_blen", bLen), [bLen]);
	useEffect(() => save("mb_voice", voiceOn), [voiceOn]);
	useEffect(() => save("mb_smart", smartKeywords), [smartKeywords]);

	/* ═══════════ Derived ═══════════ */
	const isDark = theme === "dark";
	const timeStr = currentTime.toLocaleTimeString("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const dateStr = currentTime.toLocaleDateString("ko-KR", {
		month: "long",
		day: "numeric",
		weekday: "long",
	});

	const brief = mockBriefings[tone] || mockBriefings.friendly;

	const dday = (ds) => {
		const target = new Date(ds);
		const now = new Date();
		target.setHours(0, 0, 0, 0);
		now.setHours(0, 0, 0, 0);
		return Math.ceil((target - now) / 864e5);
	};

	/* ═══════════ Handlers ═══════════ */
	const login = () => {
		setIsLoggedIn(true);
		save("mb_login", true);
	};
	const logout = () => {
		setIsLoggedIn(false);
		save("mb_login", false);
	};
	const finishOB = () => {
		setOnboarded(true);
		save("mb_onboarded", true);
		save("mb_cats", selCats);
		save("mb_perms", perms);
		const nv = { ...vis };
		if (perms.cal) nv.calendar = true;
		if (perms.fit) nv.health = true;
		setVis(nv);
		setShowOnboarding(false);
	};
	const toggleCat = (id) =>
		setSelCats((p) =>
			p.includes(id) ? p.filter((c) => c !== id) : [...p, id],
		);
	const toggleTodo = (id) =>
		setTodo((p) =>
			p.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
		);
	const addTodo = () => {
		const txt = newTodoText.trim();
		if (!txt) return;
		setTodo((p) => [...p, { id: Date.now(), text: txt, completed: false }]);
		setNewTodoText("");
		setShowAddTodo(false);
	};
	const deleteTodo = (id) => setTodo((p) => p.filter((t) => t.id !== id));
	const handleSearch = (e) => {
		e.preventDefault();
		if (searchQuery.trim())
			window.open(
				`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
				"_blank",
				"noopener,noreferrer",
			);
	};
	const closeWidget = (id) => setVis((p) => ({ ...p, [id]: false }));
	const toggleVis = (id) => setVis((p) => ({ ...p, [id]: !p[id] }));
	const handleBgUpload = (e) => {
		const f = e.target.files?.[0];
		if (!f) return;
		const r = new FileReader();
		r.onloadend = () => {
			setBgImage(r.result);
			save("mb_bg", r.result);
		};
		r.readAsDataURL(f);
	};
	const removeBg = () => {
		setBgImage(null);
		save("mb_bg", null);
	};
	const spinRoulette = () => {
		if (spinning) return;
		setSpinning(true);
		setRouletteResult(null);
		let c = 0;
		const iv = setInterval(() => {
			setRouletteResult(
				mockFoods[Math.floor(Math.random() * mockFoods.length)],
			);
			if (++c >= 20) {
				clearInterval(iv);
				setSpinning(false);
			}
		}, 100);
	};
	const speakBrief = () => {
		if (speaking) {
			window.speechSynthesis.cancel();
			setSpeaking(false);
			return;
		}
		const u = new SpeechSynthesisUtterance(brief.detail);
		u.lang = "ko-KR";
		u.rate = bLen === "short" ? 1.2 : bLen === "long" ? 0.8 : 1;
		u.onend = () => setSpeaking(false);
		setSpeaking(true);
		window.speechSynthesis.speak(u);
	};

	/* Smart widget handlers */
	const addSmartWidget = () => {
		const kw = newKeyword.trim();
		if (!kw || smartKeywords.includes(kw)) return;
		setSmartKeywords((p) => [...p, kw]);
		/* Add layout entry for the new smart widget */
		const newKey = `smart_${kw}`;
		setLayouts((prev) => {
			const next = {};
			for (const bp of Object.keys(prev)) {
				const arr = [...prev[bp]];
				const addIdx = arr.findIndex((l) => l.i === "addSmart");
				const addItem = addIdx >= 0 ? arr[addIdx] : null;
				const maxY = arr.reduce((m, l) => Math.max(m, l.y + l.h), 0);
				arr.push({
					i: newKey,
					x: addItem ? addItem.x : 4,
					y: addItem ? addItem.y : maxY,
					w: 4,
					h: 10,
					minW: 3,
					minH: 6,
				});
				if (addItem) {
					arr[addIdx] = { ...addItem, y: addItem.y + 10 };
				}
				next[bp] = arr;
			}
			save("mb_layouts", next);
			return next;
		});
		setNewKeyword("");
		setShowAddSmart(false);
	};
	const removeSmartWidget = (kw) => {
		setSmartKeywords((p) => p.filter((k) => k !== kw));
		const removeKey = `smart_${kw}`;
		setLayouts((prev) => {
			const next = {};
			for (const bp of Object.keys(prev)) {
				next[bp] = prev[bp].filter((l) => l.i !== removeKey);
			}
			save("mb_layouts", next);
			return next;
		});
	};
	const refreshSmartWidget = (kw) => {
		setRefreshing((p) => ({ ...p, [kw]: true }));
		setTimeout(() => setRefreshing((p) => ({ ...p, [kw]: false })), 1500);
	};

	/* Layout handler */
	const handleLayoutChange = (_currentLayout, allLayouts) => {
		setLayouts(allLayouts);
		save("mb_layouts", allLayouts);
	};

	const resetLayout = () => {
		setLayouts(DEFAULT_LAYOUTS);
		save("mb_layouts", DEFAULT_LAYOUTS);
	};

	/* ═══════════ Theme classes ═══════════ */
	const cardCls = isDark
		? "bg-white/10 border-white/20 text-white"
		: "bg-white/80 border-gray-200 text-slate-800";
	const muted = isDark ? "opacity-60" : "text-slate-500";
	const inputCls = isDark
		? "bg-white/10 border-white/20 placeholder:text-white/30 text-white"
		: "bg-white/60 border-gray-300 placeholder:text-gray-400 text-slate-800";

	/* ═══════════ Sub-components ═══════════ */
	const Toggle = ({ on, onToggle }) => (
		<button
			type="button"
			onClick={onToggle}
			className={`w-11 h-6 rounded-full relative transition-colors ${on ? "bg-blue-500" : isDark ? "bg-white/20" : "bg-gray-300"}`}
		>
			<div
				className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${on ? "translate-x-5" : "translate-x-0.5"}`}
			/>
		</button>
	);

	const DragHandle = () =>
		editMode ? (
			<div className="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity text-blue-400">
				<GripVertical size={14} />
			</div>
		) : null;

	const WidgetCard = ({ title, icon: Icon, widgetId, children, noPad }) => (
		<div
			className={`backdrop-blur-md border rounded-2xl ${noPad ? "" : "p-5"} shadow-xl h-full overflow-auto transition-all ${cardCls}`}
		>
			<div
				className={`flex items-center justify-between ${noPad ? "p-5 pb-0" : "mb-4"}`}
			>
				<div className="flex items-center gap-2">
					<DragHandle />
					{Icon && (
						<Icon
							size={18}
							className={isDark ? "text-blue-300" : "text-blue-600"}
						/>
					)}
					<h3 className="font-semibold text-sm">{title}</h3>
				</div>
				{widgetId && (
					<button
						onClick={() => closeWidget(widgetId)}
						className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
						title="위젯 끄기"
					>
						<X size={14} />
					</button>
				)}
			</div>
			<div className={noPad ? "p-5 pt-3" : ""}>{children}</div>
		</div>
	);

	/* ═══════════ Compute visible layout ═══════════ */
	const visibleKeys = useMemo(() => {
		const keys = new Set();
		for (const w of WIDGET_LIST) {
			if (vis[w.id]) keys.add(w.id);
		}
		for (const kw of smartKeywords) {
			keys.add(`smart_${kw}`);
		}
		keys.add("addSmart");
		return keys;
	}, [vis, smartKeywords]);

	const filteredLayouts = useMemo(() => {
		const out = {};
		for (const bp of Object.keys(layouts)) {
			out[bp] = layouts[bp].filter((l) => visibleKeys.has(l.i));
		}
		return out;
	}, [layouts, visibleKeys]);

	/* ═══════════ Smart Widget Card sub-cmp ═══════════ */
	const SmartWidgetContent = ({ keyword }) => {
		const data = mockSmartWidgets[keyword];
		const isRefreshing = refreshing[keyword];

		if (!data) {
			return (
				<div className="h-full flex flex-col">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<DragHandle />
							<Sparkles
								size={18}
								className={isDark ? "text-yellow-300" : "text-yellow-600"}
							/>
							<h3 className="font-semibold text-sm">🔍 {keyword}</h3>
							<span
								className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
							>
								Smart
							</span>
						</div>
						<button
							onClick={() => removeSmartWidget(keyword)}
							className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
						>
							<X size={14} />
						</button>
					</div>
					<div
						className={`text-center py-8 rounded-xl flex-grow flex flex-col items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-50"}`}
					>
						<div className="text-3xl mb-3 animate-pulse">🤖</div>
						<p className="text-sm font-medium mb-1">
							AI가 '{keyword}' 데이터를 수집 중입니다...
						</p>
						<p className={`text-xs ${muted}`}>
							백엔드 연동 시 실시간 데이터가 표시됩니다
						</p>
					</div>
				</div>
			);
		}

		return (
			<div className="h-full flex flex-col overflow-auto">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<DragHandle />
						<Sparkles
							size={18}
							className={isDark ? "text-yellow-300" : "text-yellow-600"}
						/>
						<h3 className="font-semibold text-sm">
							{data.emoji} {keyword}
						</h3>
						<span
							className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
						>
							Smart
						</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className={`text-[10px] ${muted}`}>{data.lastUpdated}</span>
						<button
							onClick={() => refreshSmartWidget(keyword)}
							className={`p-1 rounded-lg transition-all ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"} ${isRefreshing ? "animate-spin" : ""}`}
							title="새로고침"
						>
							<RefreshCw size={12} className={muted} />
						</button>
						<button
							onClick={() => removeSmartWidget(keyword)}
							className={`p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"} ${muted} hover:opacity-100`}
							title="위젯 삭제"
						>
							<X size={14} />
						</button>
					</div>
				</div>

				{isRefreshing ? (
					<div
						className={`text-center py-6 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
					>
						<RefreshCw
							size={24}
							className="animate-spin mx-auto mb-2 text-blue-400"
						/>
						<p className={`text-xs ${muted}`}>데이터 갱신 중...</p>
					</div>
				) : (
					<>
						{data.sections
							.filter((s) => s.type === "price")
							.map((section, i) => (
								<div key={i} className="mb-3">
									<p
										className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}
									>
										{section.title}
									</p>
									<div className="space-y-1.5">
										{section.items.map((item, j) => (
											<div
												key={j}
												className={`flex items-center justify-between p-2.5 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
											>
												<div>
													<p className="text-xs font-medium">{item.name}</p>
													<p className={`text-[10px] ${muted}`}>
														{item.source}
													</p>
												</div>
												<div className="text-right">
													<p className="text-sm font-bold">{item.price}</p>
													<p
														className={`text-[10px] font-medium ${item.change.startsWith("-") ? "text-blue-400" : "text-red-400"}`}
													>
														{item.change}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							))}
						{data.sections
							.filter((s) => s.type === "trend")
							.map((section, i) => (
								<div key={i} className="mb-3">
									<p
										className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${muted}`}
									>
										{section.title}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{section.tags.map((tag, j) => (
											<span
												key={j}
												className={`text-[10px] px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${isDark ? "bg-white/5 border-white/10 hover:bg-white/15" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
											>
												{tag}
											</span>
										))}
									</div>
								</div>
							))}
						{data.sections
							.filter((s) => s.type === "news")
							.map((section, i) => (
								<div key={i}>
									<p
										className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${muted}`}
									>
										{section.title}
									</p>
									<div className="space-y-1">
										{section.items.map((item, j) => (
											<div
												key={j}
												className={`p-2 rounded-lg cursor-pointer transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
											>
												<p className="text-xs">{item.title}</p>
												<p className={`text-[10px] ${muted}`}>
													{item.source} · {item.time}
												</p>
											</div>
										))}
									</div>
								</div>
							))}
						<p className={`text-[10px] text-center mt-3 ${muted}`}>
							⚠️ 백엔드 연동 시 AI가 실시간 데이터를 자동 수집합니다
						</p>
					</>
				)}
			</div>
		);
	};

	/* ═══════════════════════════════════════════
	   LOGIN SCREEN
	   ═══════════════════════════════════════════ */
	if (!isLoggedIn) {
		return (
			<div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center text-white font-sans">
				<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
				<div className="relative z-10 flex flex-col items-center gap-8">
					<div className="text-center">
						<h1 className="text-5xl font-bold tracking-tight mb-2">
							Morning
							<span className="text-blue-400">Brief</span>.AI
						</h1>
						<p className="text-white/60 text-lg">
							나만을 위한 AI 모닝 대시보드
						</p>
					</div>
					<button
						onClick={login}
						className="flex items-center gap-3 bg-white text-slate-800 px-8 py-4 rounded-2xl font-bold text-base hover:bg-blue-50 transition-all shadow-2xl hover:shadow-blue-500/20 hover:scale-105"
					>
						<span className="text-2xl">G</span>
						구글 계정으로 시작하기
					</button>
					<p className="text-white/30 text-xs">
						Chrome Extension · 광고 없는 순수 개인화 경험
					</p>
				</div>
			</div>
		);
	}

	/* ═══════════════════════════════════════════
	   MAIN DASHBOARD
	   ═══════════════════════════════════════════ */
	return (
		<div
			className={`min-h-screen w-full font-sans overflow-x-hidden relative ${
				isDark
					? "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-slate-100"
					: "bg-gradient-to-br from-slate-50 via-blue-50 to-white text-slate-800"
			}`}
			style={
				bgImage
					? {
							backgroundImage: `url(${bgImage})`,
							backgroundSize: "cover",
							backgroundPosition: "center",
						}
					: undefined
			}
		>
			{!bgImage && (
				<>
					<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
					<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
				</>
			)}
			{bgImage && (
				<div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
			)}

			{/* ── Top Nav ── */}
			<div className="relative z-10 w-full p-6 flex justify-between items-start">
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/30">
							<User size={20} className="text-white" />
						</div>
						<div>
							<p className={`text-xs ${muted}`}>안녕하세요,</p>
							<p className="font-bold text-sm tracking-tight">
								MorningBrief.AI User
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						{mockBookmarks.map((link, i) => (
							<a
								key={i}
								href={link.url}
								target="_blank"
								rel="noreferrer"
								title={link.name}
								className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border group ${
									isDark
										? "bg-white/5 hover:bg-white/20 border-white/10"
										: "bg-white/50 hover:bg-white/80 border-gray-200"
								}`}
							>
								<span className="font-bold text-xs group-hover:scale-110 transition-transform inline-block">
									{link.icon}
								</span>
							</a>
						))}
					</div>
				</div>
				<button
					onClick={() => setTheme(isDark ? "light" : "dark")}
					className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
						isDark
							? "bg-white/5 hover:bg-white/15 border-white/10"
							: "bg-white/50 hover:bg-white/80 border-gray-200"
					}`}
				>
					{isDark ? <Moon size={18} /> : <Sun size={18} />}
				</button>
			</div>

			{/* ── Center: Clock & Search ── */}
			<div className="relative z-10 flex flex-col items-center pt-8 pb-6 px-6">
				<div className="text-center mb-6">
					<h1 className="text-7xl font-light tracking-tighter mb-2 drop-shadow-2xl">
						{timeStr}
					</h1>
					<p
						className={`text-lg font-medium ${isDark ? "opacity-80" : "text-slate-600"}`}
					>
						{dateStr}
					</p>
				</div>

				<form
					onSubmit={handleSearch}
					className="w-full max-w-xl relative group mb-10"
				>
					<div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
						<Search
							className={`${isDark ? "text-white/40" : "text-gray-400"} group-focus-within:text-blue-400 transition-colors`}
							size={20}
						/>
					</div>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="검색하거나 AI에게 물어보세요..."
						className={`w-full h-14 backdrop-blur-xl rounded-full pl-12 pr-6 text-base outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-xl border ${inputCls}`}
					/>
				</form>

				{/* ══════════ D&D Widget Grid ══════════ */}
				<div className="w-full max-w-[1400px]" ref={gridContainerRef}>
					{gridWidth > 0 && (
						<ResponsiveGridLayout
							width={gridWidth}
							className={`layout ${editMode ? "edit-mode" : ""}`}
							layouts={filteredLayouts}
							breakpoints={{ lg: 1024, md: 768, sm: 0 }}
							cols={{ lg: 12, md: 10, sm: 6 }}
							rowHeight={30}
							onLayoutChange={handleLayoutChange}
							draggableHandle=".drag-handle"
							compactType="vertical"
							margin={[16, 16]}
							isDraggable={editMode}
							isResizable={editMode}
						>
							{/* Health */}
							{vis.health && (
								<div key="health">
									<WidgetCard
										title="건강 (Google Fit)"
										icon={Activity}
										widgetId="health"
									>
										{healthData ? (
											<div className="space-y-3">
												<div className="flex justify-between items-center">
													<span className="text-xs">🚶 걸음</span>
													<span className="text-xs font-bold">
														{healthData.steps.toLocaleString()} /{" "}
														{healthData.stepsGoal.toLocaleString()}
													</span>
												</div>
												<div
													className={`w-full h-1.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}
												>
													<div
														className="h-full bg-green-500 rounded-full"
														style={{
															width: `${(healthData.steps / healthData.stepsGoal) * 100}%`,
														}}
													/>
												</div>
												<div className="flex justify-between items-center">
													<span className="text-xs">😴 수면</span>
													<span className="text-xs font-bold">
														{healthData.sleep}h / {healthData.sleepGoal}h
													</span>
												</div>
												<div
													className={`w-full h-1.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}
												>
													<div
														className="h-full bg-indigo-500 rounded-full"
														style={{
															width: `${(healthData.sleep / healthData.sleepGoal) * 100}%`,
														}}
													/>
												</div>
												<div className="grid grid-cols-2 gap-2 mt-2">
													<div
														className={`text-center p-2 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}
													>
														<p className="text-lg font-bold">
															❤️ {healthData.heartRate}
														</p>
														<p className={`text-[10px] ${muted}`}>BPM</p>
													</div>
													<div
														className={`text-center p-2 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}
													>
														<p className="text-lg font-bold">
															💧 {healthData.water}/{healthData.waterGoal}
														</p>
														<p className={`text-[10px] ${muted}`}>잔</p>
													</div>
												</div>
												<p className={`text-[10px] text-center mt-1 ${muted}`}>
													⚠️ Google Fit 연동 시 실제 데이터로 대체됩니다
												</p>
											</div>
										) : (
											<p className="text-sm opacity-50">
												건강 데이터 로딩 중...
											</p>
										)}
									</WidgetCard>
								</div>
							)}

							{/* Calendar */}
							{vis.calendar && (
								<div key="calendar">
									<WidgetCard
										title="오늘 일정 (Google Calendar)"
										icon={Calendar}
										widgetId="calendar"
									>
										<div className="space-y-2">
											{calEvents.map((ev, i) => (
												<div key={i} className="flex items-center gap-3">
													<div
														className="w-1 h-8 rounded-full flex-shrink-0"
														style={{ backgroundColor: ev.color }}
													/>
													<div className="flex-grow">
														<p className="text-xs font-medium">{ev.title}</p>
														<p className={`text-[10px] ${muted}`}>
															{ev.time} · {ev.location}
														</p>
													</div>
												</div>
											))}
											<p className={`text-[10px] text-center mt-1 ${muted}`}>
												⚠️ Google Calendar 연동 시 실제 일정으로 대체됩니다
											</p>
										</div>
									</WidgetCard>
								</div>
							)}

							{/* Todo */}
							{vis.todo && (
								<div key="todo">
									<WidgetCard
										title="오늘의 할 일"
										icon={CheckCircle2}
										widgetId="todo"
									>
										<div className="space-y-3">
											{todo.map((t) => (
												<div
													key={t.id}
													className="flex items-center gap-3 group"
												>
													<button
														onClick={() => toggleTodo(t.id)}
														className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${
															t.completed
																? "bg-blue-500 border-blue-500"
																: isDark
																	? "border-white/30 hover:border-blue-400"
																	: "border-gray-300 hover:border-blue-400"
														}`}
													>
														{t.completed && (
															<CheckCircle2 size={12} className="text-white" />
														)}
													</button>
													<span
														className={`text-sm flex-grow ${t.completed ? "line-through opacity-40" : ""}`}
													>
														{t.text}
													</span>
													<button
														onClick={() => deleteTodo(t.id)}
														className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
													>
														<X size={14} />
													</button>
												</div>
											))}
											{showAddTodo ? (
												<div className="flex items-center gap-2 mt-2">
													<input
														type="text"
														value={newTodoText}
														onChange={(e) => setNewTodoText(e.target.value)}
														onKeyDown={(e) => e.key === "Enter" && addTodo()}
														placeholder="할 일 입력..."
														autoFocus
														className={`flex-grow rounded-lg px-3 py-1.5 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
													/>
													<button
														onClick={addTodo}
														className="text-blue-400 text-sm font-medium"
													>
														추가
													</button>
													<button
														onClick={() => {
															setShowAddTodo(false);
															setNewTodoText("");
														}}
													>
														<X size={16} className={muted} />
													</button>
												</div>
											) : (
												<button
													onClick={() => setShowAddTodo(true)}
													className="flex items-center gap-2 text-xs text-blue-400 mt-3 hover:underline"
												>
													<Plus size={14} /> 새 할 일 추가
												</button>
											)}
										</div>
									</WidgetCard>
								</div>
							)}

							{/* AI Briefing */}
							{vis.briefing && (
								<div key="briefing">
									<div
										className={`backdrop-blur-md border rounded-2xl p-6 shadow-xl flex flex-col items-center text-center relative h-full overflow-auto ${
											isDark
												? "bg-gradient-to-br from-blue-600/40 to-indigo-600/40 border-white/20 text-white"
												: "bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-200 text-slate-800"
										}`}
									>
										<div className="absolute top-4 right-4 flex items-center gap-1">
											{editMode && (
												<div className="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity text-blue-400">
													<GripVertical size={14} />
												</div>
											)}
											<button
												onClick={() => closeWidget("briefing")}
												className="opacity-40 hover:opacity-100 transition-opacity"
												title="위젯 끄기"
											>
												<X size={14} />
											</button>
										</div>
										<p
											className={`text-xs uppercase tracking-widest mb-2 ${muted}`}
										>
											Morning Digest
										</p>
										<h2 className="text-lg font-bold mb-2">{brief.summary}</h2>
										<p className={`text-xs mb-4 leading-relaxed ${muted}`}>
											{bLen === "short"
												? brief.detail.split(".")[0] + "."
												: brief.detail}
										</p>
										<div className="flex gap-2">
											<button
												onClick={speakBrief}
												className={`px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors ${
													isDark
														? "bg-white text-blue-900 hover:bg-blue-50"
														: "bg-blue-600 text-white hover:bg-blue-700"
												}`}
											>
												{speaking ? (
													<>
														<VolumeX size={16} /> 중지
													</>
												) : (
													<>
														<Volume2 size={16} /> 브리핑 듣기
													</>
												)}
											</button>
											<button
												onClick={() => setShowBriefSettings(true)}
												className={`px-3 py-2 rounded-full text-sm transition-colors ${isDark ? "bg-white/20 hover:bg-white/30" : "bg-blue-200 hover:bg-blue-300"}`}
											>
												<Settings size={14} />
											</button>
										</div>
									</div>
								</div>
							)}

							{/* Trends */}
							{vis.trends && (
								<div key="trends">
									<WidgetCard
										title="실시간 트렌드"
										icon={TrendingUp}
										widgetId="trends"
									>
										<div className="flex flex-wrap gap-2">
											{trends.map((tag, i) => (
												<span
													key={i}
													className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors border ${
														isDark
															? "bg-white/5 border-white/10 hover:bg-white/15"
															: "bg-gray-50 border-gray-200 hover:bg-gray-100"
													}`}
												>
													{tag}
												</span>
											))}
										</div>
									</WidgetCard>
								</div>
							)}

							{/* Stocks */}
							{vis.stocks && (
								<div key="stocks">
									<WidgetCard
										title="주식/환율"
										icon={TrendingUp}
										widgetId="stocks"
									>
										<div className="grid grid-cols-2 gap-2">
											{stocks.map((s, i) => (
												<div
													key={i}
													className={`p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
												>
													<div className="flex justify-between items-center mb-1">
														<span className={`text-[10px] ${muted}`}>
															{s.name}
														</span>
														<span
															className={`text-[10px] ${s.up ? "text-red-400" : "text-blue-400"}`}
														>
															{s.up ? "▲" : "▼"} {s.change}
														</span>
													</div>
													<p className="text-lg font-bold">{s.value}</p>
												</div>
											))}
										</div>
									</WidgetCard>
								</div>
							)}

							{/* Weather */}
							{vis.weather && (
								<div key="weather">
									<WidgetCard title="현재 날씨" icon={Sun} widgetId="weather">
										{weather ? (
											<div className="flex items-center justify-between">
												<div>
													<p className="text-3xl font-bold">{weather.temp}°C</p>
													<p className={`text-xs ${muted}`}>
														{weather.city}, {weather.condition}
													</p>
												</div>
												<div className="text-right">
													<p className={`text-[10px] ${muted}`}>
														강수확률 {weather.precipitation}%
													</p>
													<p className={`text-[10px] ${muted}`}>
														미세먼지 {weather.airQuality}
													</p>
													<p className={`text-[10px] ${muted}`}>
														습도 {weather.humidity}%
													</p>
												</div>
											</div>
										) : (
											<p className="text-sm opacity-50">
												날씨 정보를 불러오는 중...
											</p>
										)}
									</WidgetCard>
								</div>
							)}

							{/* Food Roulette */}
							{vis.foodRoulette && (
								<div key="foodRoulette">
									<WidgetCard
										title="메뉴 결정 도우미"
										icon={Star}
										widgetId="foodRoulette"
									>
										<div className="text-center py-2">
											<div
												className={`text-4xl font-bold mb-3 h-14 flex items-center justify-center rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"} ${spinning ? "animate-pulse" : ""}`}
											>
												{rouletteResult ? (
													<span>
														{spinning ? "🎰" : "🍽️"} {rouletteResult}
													</span>
												) : (
													<span className={`text-lg ${muted}`}>
														오늘 뭐 먹지?
													</span>
												)}
											</div>
											<button
												onClick={spinRoulette}
												disabled={spinning}
												className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${spinning ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
											>
												{spinning
													? "돌리는 중..."
													: rouletteResult
														? "다시 돌리기 🎲"
														: "룰렛 돌리기 🎲"}
											</button>
										</div>
									</WidgetCard>
								</div>
							)}

							{/* Brand Drop D-Day */}
							{vis.brandDrop && (
								<div key="brandDrop">
									<WidgetCard
										title="브랜드 Drop D-Day"
										icon={ShoppingBag}
										widgetId="brandDrop"
									>
										<div className="space-y-2">
											{mockBrandDrops.map((item, i) => {
												const d = dday(item.date);
												return (
													<div
														key={i}
														className={`flex items-center justify-between p-2 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}
													>
														<div className="flex items-center gap-2">
															<span className="text-lg">{item.emoji}</span>
															<div>
																<p className="text-xs font-bold">
																	{item.brand}
																</p>
																<p className={`text-[10px] ${muted}`}>
																	{item.product}
																</p>
															</div>
														</div>
														<span
															className={`text-xs font-bold px-2 py-1 rounded-lg ${
																d <= 3
																	? "bg-red-500/20 text-red-400"
																	: d <= 7
																		? "bg-yellow-500/20 text-yellow-400"
																		: isDark
																			? "bg-white/10"
																			: "bg-gray-200"
															}`}
														>
															{d <= 0 ? "🔥 TODAY" : `D-${d}`}
														</span>
													</div>
												);
											})}
											<p className={`text-[10px] text-center ${muted}`}>
												⚠️ 백엔드 연동 시 AI가 발매 정보를 자동 추적합니다
											</p>
										</div>
									</WidgetCard>
								</div>
							)}

							{/* Restaurants */}
							{vis.restaurants && (
								<div key="restaurants">
									<WidgetCard
										title="주변 맛집"
										icon={MapPin}
										widgetId="restaurants"
									>
										<div className="space-y-2">
											{mockRestaurants.map((r, i) => (
												<div
													key={i}
													className={`flex items-center justify-between p-2 rounded-lg ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
												>
													<div>
														<p className="text-sm font-medium">{r.name}</p>
														<p className={`text-[10px] ${muted}`}>
															{r.category} · {r.distance} · {r.price}
														</p>
													</div>
													<div className="flex items-center gap-1">
														<Star
															size={10}
															className="text-yellow-400 fill-yellow-400"
														/>
														<span className="text-xs font-bold">
															{r.rating}
														</span>
													</div>
												</div>
											))}
											<p className={`text-[10px] text-center ${muted}`}>
												⚠️ 지도 API 연동 시 실제 위치 기반 데이터로 대체됩니다
											</p>
										</div>
									</WidgetCard>
								</div>
							)}

							{/* Smart Widgets */}
							{smartKeywords.map((kw) => (
								<div key={`smart_${kw}`}>
									<div
										className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl h-full overflow-auto ${cardCls}`}
									>
										<SmartWidgetContent keyword={kw} />
									</div>
								</div>
							))}

							{/* Add Smart Widget Button */}
							<div key="addSmart">
								{showAddSmart ? (
									<div
										className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl h-full ${cardCls}`}
									>
										<div className="flex items-center gap-2 mb-2">
											<Sparkles
												size={16}
												className={
													isDark ? "text-yellow-300" : "text-yellow-600"
												}
											/>
											<span className="font-semibold text-xs">
												스마트 위젯 추가
											</span>
										</div>
										<div className="flex gap-2">
											<input
												type="text"
												value={newKeyword}
												onChange={(e) => setNewKeyword(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && addSmartWidget()}
												placeholder="키워드 입력..."
												autoFocus
												className={`flex-grow rounded-xl px-3 py-2 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
											/>
											<button
												onClick={addSmartWidget}
												className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-xl text-xs font-bold"
											>
												추가
											</button>
											<button
												onClick={() => {
													setShowAddSmart(false);
													setNewKeyword("");
												}}
											>
												<X size={14} className={muted} />
											</button>
										</div>
									</div>
								) : (
									<button
										onClick={() => setShowAddSmart(true)}
										className={`w-full h-full backdrop-blur-md border-2 border-dashed rounded-2xl flex items-center justify-center gap-2 transition-all ${
											isDark
												? "border-white/20 hover:bg-white/5 text-white/60 hover:text-white/80"
												: "border-gray-300 hover:bg-gray-50 text-gray-400 hover:text-gray-600"
										}`}
									>
										<Plus size={16} />
										<span className="text-sm font-medium">
											스마트 위젯 추가
										</span>
									</button>
								)}
							</div>
						</ResponsiveGridLayout>
					)}
				</div>
			</div>

			{/* ── Fixed Buttons ── */}
			<div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3">
				{/* Edit Mode Toggle */}
				<button
					onClick={() => setEditMode((p) => !p)}
					title={editMode ? "편집 모드 끄기" : "위젯 배치 편집"}
					className={`w-12 h-12 backdrop-blur-md border rounded-full flex items-center justify-center transition-all shadow-lg group ${
						editMode
							? "bg-blue-500 border-blue-400 text-white ring-2 ring-blue-400/50 animate-pulse"
							: isDark
								? "bg-white/5 hover:bg-white/15 border-white/10"
								: "bg-white/50 hover:bg-white/80 border-gray-200"
					}`}
				>
					{editMode ? (
						<Unlock size={20} />
					) : (
						<Lock size={20} className="opacity-60" />
					)}
				</button>
				{/* Settings */}
				<button
					onClick={() => setShowSettings(true)}
					className={`w-12 h-12 backdrop-blur-md border rounded-full flex items-center justify-center transition-all shadow-lg group ${
						isDark
							? "bg-white/5 hover:bg-white/15 border-white/10"
							: "bg-white/50 hover:bg-white/80 border-gray-200"
					}`}
				>
					<Settings
						size={22}
						className="opacity-60 group-hover:rotate-45 transition-transform duration-500"
					/>
				</button>
			</div>

			{/* ── Edit Mode Banner ── */}
			{editMode && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-full backdrop-blur-md shadow-lg border flex items-center gap-3 bg-blue-500/90 border-blue-400 text-white">
					<GripVertical size={16} />
					<span className="text-sm font-medium">
						편집 모드 — 위젯을 드래그하거나 크기를 조절하세요
					</span>
					<button
						onClick={() => setEditMode(false)}
						className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold transition-colors"
					>
						완료
					</button>
				</div>
			)}

			{/* ── Branding ── */}
			<div className="relative z-10 pb-8 text-center">
				<span
					className={`text-sm font-bold tracking-[0.4em] uppercase ${muted}`}
				>
					MorningBrief.AI
				</span>
			</div>

			{/* ══════════════════════════════════════════
			    ONBOARDING MODAL
			    ══════════════════════════════════════════ */}
			{showOnboarding && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-slate-800 border border-white/20 rounded-3xl w-full max-w-lg p-8 text-white shadow-2xl">
						{obStep === 0 && (
							<div className="space-y-6">
								<div className="text-center">
									<p className="text-3xl mb-2">👋</p>
									<h2 className="text-2xl font-bold mb-1">환영합니다!</h2>
									<p className="text-white/60 text-sm">
										관심사를 선택하면 맞춤 위젯을 추천해드려요
									</p>
								</div>
								<div className="grid grid-cols-2 gap-3">
									{CATEGORIES.map((c) => (
										<button
											key={c.id}
											onClick={() => toggleCat(c.id)}
											className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
												selCats.includes(c.id)
													? "border-blue-500 bg-blue-500/20"
													: "border-white/10 bg-white/5 hover:bg-white/10"
											}`}
										>
											<span className="text-xl">{c.emoji}</span>
											<span className="font-medium text-sm">{c.label}</span>
										</button>
									))}
								</div>
								<button
									onClick={() => setObStep(1)}
									className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-colors"
								>
									다음 →
								</button>
							</div>
						)}
						{obStep === 1 && (
							<div className="space-y-6">
								<div className="text-center">
									<p className="text-3xl mb-2">🔗</p>
									<h2 className="text-2xl font-bold mb-1">데이터 연동</h2>
									<p className="text-white/60 text-sm">
										외부 서비스를 연결하면 더 스마트한 브리핑을 받아요
									</p>
								</div>
								<div className="space-y-3">
									{[
										{
											key: "fit",
											icon: <Activity size={20} className="text-green-400" />,
											label: "Google Fit",
											desc: "운동량, 수면 패턴 등 건강 데이터",
										},
										{
											key: "cal",
											icon: <Calendar size={20} className="text-blue-400" />,
											label: "Google Calendar",
											desc: "일정 확인 및 리마인더",
										},
									].map((item) => (
										<div
											key={item.key}
											className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
										>
											<div className="flex items-center gap-3">
												{item.icon}
												<div>
													<p className="font-medium text-sm">{item.label}</p>
													<p className="text-xs text-white/40">{item.desc}</p>
												</div>
											</div>
											<Toggle
												on={perms[item.key]}
												onToggle={() =>
													setPerms((p) => ({ ...p, [item.key]: !p[item.key] }))
												}
											/>
										</div>
									))}
								</div>
								<div className="flex gap-3">
									<button
										onClick={() => setObStep(0)}
										className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold transition-colors"
									>
										← 이전
									</button>
									<button
										onClick={finishOB}
										className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-colors"
									>
										완료 ✓
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ══════════════════════════════════════════
			    SETTINGS MODAL
			    ══════════════════════════════════════════ */}
			{showSettings && (
				<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div
						className={`w-full max-w-2xl rounded-3xl shadow-2xl border overflow-hidden ${
							isDark
								? "bg-slate-800 border-white/20 text-white"
								: "bg-white border-gray-200 text-slate-800"
						}`}
					>
						<div
							className={`flex items-center justify-between p-6 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}
						>
							<h2 className="text-lg font-bold">⚙️ 설정</h2>
							<button onClick={() => setShowSettings(false)}>
								<X size={20} className="opacity-60 hover:opacity-100" />
							</button>
						</div>
						<div className="flex min-h-[400px]">
							<div
								className={`w-44 border-r p-4 space-y-1 ${isDark ? "border-white/10" : "border-gray-200"}`}
							>
								{[
									{ id: "widgets", label: "위젯 관리" },
									{ id: "smart", label: "스마트 위젯" },
									{ id: "layout", label: "레이아웃" },
									{ id: "theme", label: "테마" },
									{ id: "profile", label: "프로필" },
								].map((tab) => (
									<button
										key={tab.id}
										onClick={() => setSettingsTab(tab.id)}
										className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
											settingsTab === tab.id
												? isDark
													? "bg-blue-600/30 text-blue-300"
													: "bg-blue-50 text-blue-600"
												: isDark
													? "hover:bg-white/10"
													: "hover:bg-gray-100"
										}`}
									>
										{tab.label}
									</button>
								))}
							</div>
							<div className="flex-1 p-6 overflow-y-auto max-h-[500px]">
								{settingsTab === "widgets" && (
									<div className="space-y-3">
										<p className={`text-xs mb-2 ${muted}`}>
											기본 위젯을 켜고 끌 수 있습니다. 꺼진 위젯은 여기서 다시
											활성화하세요.
										</p>
										{WIDGET_LIST.map((w) => (
											<div
												key={w.id}
												className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
											>
												<div className="flex items-center gap-2">
													<span className="text-sm">{w.label}</span>
													{w.category === "smart" && (
														<span
															className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
														>
															Smart
														</span>
													)}
													{!vis[w.id] && (
														<span
															className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-600"}`}
														>
															꺼짐
														</span>
													)}
												</div>
												<Toggle
													on={vis[w.id]}
													onToggle={() => toggleVis(w.id)}
												/>
											</div>
										))}
									</div>
								)}
								{settingsTab === "smart" && (
									<div className="space-y-4">
										<p className={`text-xs mb-2 ${muted}`}>
											AI 키워드 위젯을 관리합니다. 키워드를 추가하면 AI가 관련
											데이터를 자동 수집합니다.
										</p>
										{smartKeywords.length === 0 ? (
											<p className={`text-sm text-center py-6 ${muted}`}>
												등록된 스마트 위젯이 없습니다
											</p>
										) : (
											smartKeywords.map((kw) => (
												<div
													key={kw}
													className={`flex items-center justify-between p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
												>
													<div className="flex items-center gap-2">
														<Sparkles
															size={14}
															className={
																isDark ? "text-yellow-300" : "text-yellow-600"
															}
														/>
														<span className="text-sm font-medium">
															{mockSmartWidgets[kw]?.emoji || "🔍"} {kw}
														</span>
														{mockSmartWidgets[kw] ? (
															<span
																className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-green-500/20 text-green-300" : "bg-green-100 text-green-700"}`}
															>
																데이터 있음
															</span>
														) : (
															<span
																className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"}`}
															>
																대기 중
															</span>
														)}
													</div>
													<button
														onClick={() => removeSmartWidget(kw)}
														className="text-red-400 hover:text-red-300 text-xs"
													>
														삭제
													</button>
												</div>
											))
										)}
										<div className="flex gap-2 mt-3">
											<input
												type="text"
												value={newKeyword}
												onChange={(e) => setNewKeyword(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && addSmartWidget()}
												placeholder="키워드 입력..."
												className={`flex-grow rounded-xl px-4 py-2.5 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
											/>
											<button
												onClick={addSmartWidget}
												className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold"
											>
												추가
											</button>
										</div>
									</div>
								)}
								{settingsTab === "layout" && (
									<div className="space-y-4">
										<p className={`text-xs mb-2 ${muted}`}>
											위젯을 드래그하여 원하는 위치로 이동할 수 있습니다. 위젯
											모서리를 잡아 크기를 조절할 수 있습니다.
										</p>
										<div
											className={`p-4 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
										>
											<div className="flex items-center gap-3 mb-3">
												<GripVertical
													size={18}
													className={isDark ? "text-blue-300" : "text-blue-600"}
												/>
												<div>
													<p className="text-sm font-medium">드래그 & 드롭</p>
													<p className={`text-xs ${muted}`}>
														위젯 왼쪽 상단의 ⠿ 핸들을 잡고 드래그하세요
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<RefreshCw
													size={18}
													className={isDark ? "text-blue-300" : "text-blue-600"}
												/>
												<div>
													<p className="text-sm font-medium">크기 조절</p>
													<p className={`text-xs ${muted}`}>
														위젯 오른쪽 하단 모서리를 잡아 크기를 변경하세요
													</p>
												</div>
											</div>
										</div>
										<button
											onClick={resetLayout}
											className={`w-full p-3 rounded-xl text-sm font-medium transition-colors ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"}`}
										>
											🔄 레이아웃 초기화
										</button>
									</div>
								)}
								{settingsTab === "theme" && (
									<div className="space-y-6">
										<div>
											<p className="text-sm font-medium mb-3">테마 모드</p>
											<div className="flex gap-3">
												{[
													{
														id: "dark",
														label: "다크",
														icon: <Moon size={18} />,
													},
													{
														id: "light",
														label: "라이트",
														icon: <Sun size={18} />,
													},
												].map((t) => (
													<button
														key={t.id}
														onClick={() => setTheme(t.id)}
														className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
															theme === t.id
																? "border-blue-500 bg-blue-500/20"
																: isDark
																	? "border-white/10 bg-white/5 hover:bg-white/10"
																	: "border-gray-200 bg-gray-50 hover:bg-gray-100"
														}`}
													>
														{t.icon}
														<span className="text-sm font-medium">
															{t.label}
														</span>
													</button>
												))}
											</div>
										</div>
										<div>
											<p className="text-sm font-medium mb-3">배경 이미지</p>
											<input
												type="file"
												ref={bgRef}
												accept="image/*"
												onChange={handleBgUpload}
												className="hidden"
											/>
											<div className="flex gap-3">
												<button
													onClick={() => bgRef.current?.click()}
													className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-colors ${
														isDark
															? "border-white/20 bg-white/5 hover:bg-white/10"
															: "border-gray-200 bg-gray-50 hover:bg-gray-100"
													}`}
												>
													<Image size={16} /> 이미지 업로드
												</button>
												{bgImage && (
													<button
														onClick={removeBg}
														className="px-4 py-2 rounded-xl text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
													>
														배경 제거
													</button>
												)}
											</div>
											{bgImage && (
												<div className="mt-3 rounded-xl overflow-hidden h-24">
													<img
														src={bgImage}
														alt="bg preview"
														className="w-full h-full object-cover"
													/>
												</div>
											)}
										</div>
									</div>
								)}
								{settingsTab === "profile" && (
									<div className="space-y-6">
										<div className="flex items-center gap-4">
											<div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center border-2 border-blue-400">
												<User size={28} className="text-white" />
											</div>
											<div>
												<p className="font-bold">MorningBrief.AI User</p>
												<p className={`text-xs ${muted}`}>
													user@google.com (demo)
												</p>
											</div>
										</div>
										<button
											onClick={() => {
												setOnboarded(false);
												save("mb_onboarded", false);
												setShowOnboarding(true);
												setObStep(0);
												setShowSettings(false);
											}}
											className={`w-full p-3 rounded-xl text-sm text-left ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"}`}
										>
											🔄 온보딩 다시하기
										</button>
										<button
											onClick={() => {
												logout();
												setShowSettings(false);
											}}
											className="w-full p-3 rounded-xl text-sm text-left bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-2"
										>
											<LogOut size={16} /> 로그아웃
										</button>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ══════════════════════════════════════════
			    BRIEFING SETTINGS MODAL
			    ══════════════════════════════════════════ */}
			{showBriefSettings && (
				<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div
						className={`w-full max-w-md rounded-3xl shadow-2xl border p-6 ${
							isDark
								? "bg-slate-800 border-white/20 text-white"
								: "bg-white border-gray-200 text-slate-800"
						}`}
					>
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-lg font-bold">🤖 AI 브리핑 설정</h2>
							<button onClick={() => setShowBriefSettings(false)}>
								<X size={20} className="opacity-60 hover:opacity-100" />
							</button>
						</div>
						<div className="space-y-5">
							<div>
								<p className="text-sm font-medium mb-2">톤앤매너</p>
								<div className="grid grid-cols-3 gap-2">
									{[
										{ id: "friendly", label: "친절한 😊" },
										{ id: "professional", label: "냉철한 📊" },
										{ id: "humorous", label: "유머러스 😄" },
									].map((t) => (
										<button
											key={t.id}
											onClick={() => {
												setTone(t.id);
												save("mb_tone", t.id);
											}}
											className={`p-2 rounded-xl text-xs border-2 transition-all ${
												tone === t.id
													? "border-blue-500 bg-blue-500/20"
													: isDark
														? "border-white/10 bg-white/5"
														: "border-gray-200 bg-gray-50"
											}`}
										>
											{t.label}
										</button>
									))}
								</div>
							</div>
							<div>
								<p className="text-sm font-medium mb-2">요약 길이</p>
								<div className="grid grid-cols-3 gap-2">
									{[
										{ id: "short", label: "짧게" },
										{ id: "medium", label: "보통" },
										{ id: "long", label: "자세히" },
									].map((l) => (
										<button
											key={l.id}
											onClick={() => {
												setBLen(l.id);
												save("mb_blen", l.id);
											}}
											className={`p-2 rounded-xl text-xs border-2 transition-all ${
												bLen === l.id
													? "border-blue-500 bg-blue-500/20"
													: isDark
														? "border-white/10 bg-white/5"
														: "border-gray-200 bg-gray-50"
											}`}
										>
											{l.label}
										</button>
									))}
								</div>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">음성 출력</p>
									<p className={`text-xs ${muted}`}>
										브라우저 TTS로 브리핑 읽기
									</p>
								</div>
								<Toggle
									on={voiceOn}
									onToggle={() => {
										setVoiceOn(!voiceOn);
										save("mb_voice", !voiceOn);
									}}
								/>
							</div>
						</div>
						<button
							onClick={() => setShowBriefSettings(false)}
							className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors"
						>
							저장
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default App;
