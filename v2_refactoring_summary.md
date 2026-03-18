# MorningBrief.AI v2 리팩토링 — 변경 완료 보고

> 빌드 성공 확인 ✅ (`vite build` exit code 0)

## Phase 1: 레이아웃 기반 (완료 ✅)

### 1. App.jsx — 4열 레이아웃 전면 재구성
- `LAYOUT_VERSION` → **3**으로 변경 (기존 레이아웃 강제 리셋)
- layout key: `left/center/right` → **`col1/col2/col3`**
- 비율: `flex-[1.5]` : `flex-1` : `flex-1` : `flex-[3]`
- **캘린더·Todo** → `WIDGET_COMPONENTS`에서 제거 → 별도 고정 렌더링
- 캘린더 영역: `position: sticky; top: 180px`
- 드래그 앤 드롭: col1 ↔ col2 ↔ col3 자유 이동, 캘린더 제외

```diff:App.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
import { useTodoStore } from "./store/useTodoStore";
import { useTheme } from "./hooks/useTheme";
import { supabase } from "./lib/supabase";
import { load, save } from "./utils/storage";

import LoginScreen from "./components/layout/LoginScreen";
import TopNav from "./components/layout/TopNav";
import FixedButtons from "./components/layout/FixedButtons";
import OnboardingModal from "./components/modals/OnboardingModal";
import SettingsModal from "./components/modals/SettingsModal";
import BriefSettingsModal from "./components/modals/BriefSettingsModal";

import BriefingWidget from "./components/widgets/BriefingWidget";
import MiniWidgetGrid from "./components/widgets/MiniWidgetGrid";
import DiaryCard from "./components/widgets/DiaryCard";
import CalendarWidget from "./components/widgets/CalendarWidget";
import WeatherWidget from "./components/widgets/WeatherWidget";
import StocksWidget from "./components/widgets/StocksWidget";
import TrendsWidget from "./components/widgets/TrendsWidget";
import HealthWidget from "./components/widgets/HealthWidget";
import TodoWidget from "./components/widgets/TodoWidget";
import SmartWidgetContent from "./components/widgets/SmartWidgetContent";

const LAYOUT_VERSION = 2;

const DEFAULT_LAYOUT = {
	left: ["briefing", "weather"],
	center: ["miniWidgets", "diary", "todo"],
	right: ["calendar", "stocks", "trends"],
};

const WIDGET_COMPONENTS = {
	briefing: BriefingWidget,
	miniWidgets: MiniWidgetGrid,
	diary: DiaryCard,
	calendar: CalendarWidget,
	weather: WeatherWidget,
	stocks: StocksWidget,
	trends: TrendsWidget,
	health: HealthWidget,
	todo: TodoWidget,
};

const WIDGET_LABELS = {
	briefing: "AI 브리핑",
	miniWidgets: "미니 위젯",
	diary: "다이어리",
	calendar: "캘린더",
	weather: "날씨",
	stocks: "주식/환율",
	trends: "실시간 트렌드",
	health: "건강",
	todo: "할 일",
};

const initLayout = () => {
	const savedVer = load("mb_widget_layout_ver", 0);
	if (savedVer < LAYOUT_VERSION) {
		save("mb_widget_layout_ver", LAYOUT_VERSION);
		save("mb_widget_layout", DEFAULT_LAYOUT);
		return DEFAULT_LAYOUT;
	}
	return load("mb_widget_layout", DEFAULT_LAYOUT);
};

// Stable wrapper to avoid re-mount on every render
const SmartWidget = ({ keyword }) => <SmartWidgetContent keyword={keyword} />;

const App = () => {
	const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
	const handleAuthChange = useAuthStore((s) => s.handleAuthChange);
	const { isDark } = useTheme();
	const fetchAll = useDataStore((s) => s.fetchAll);
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);

	// Drag & Drop state
	const [layout, setLayout] = useState(initLayout);
	const [dragItem, setDragItem] = useState(null);
	const [dragOverTarget, setDragOverTarget] = useState(null);

	// Supabase auth listener (also handles redirect after OAuth login)
	useEffect(() => {
		if (!supabase) return;
		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			(_event, session) => handleAuthChange(session)
		);
		return () => subscription?.unsubscribe();
	}, [handleAuthChange]);

	// Hydrate stores & fetch data on login
	useEffect(() => {
		if (!isLoggedIn) return;
		const init = async () => {
			try {
				await Promise.all([
					useSettingsStore.getState().hydrateFromDB?.(),
					useWidgetStore.getState().hydrateFromDB?.(),
					useTodoStore.getState().hydrateFromDB?.(),
				]);
			} catch (e) {
				console.warn("Hydrate failed:", e?.message);
			}
			fetchAll();
		};
		init();
	}, [isLoggedIn, fetchAll]);

	// Save layout changes to localStorage
	useEffect(() => {
		save("mb_widget_layout", layout);
	}, [layout]);

	// Sync smart keywords into layout
	useEffect(() => {
		if (!smartKeywords?.length) return;
		setLayout((prev) => {
			const allWidgets = [...prev.left, ...prev.center, ...prev.right];
			const newKeys = smartKeywords
				.map((k) => `smart_${k}`)
				.filter((id) => !allWidgets.includes(id));
			if (newKeys.length === 0) return prev;
			return { ...prev, center: [...prev.center, ...newKeys] };
		});
	}, [smartKeywords]);

	// Drag handlers
	const handleDragStart = useCallback((e, widgetId, column) => {
		setDragItem({ widgetId, column });
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", `${widgetId}|${column}`);
		requestAnimationFrame(() => {
			e.target.style.opacity = "0.4";
		});
	}, []);

	const handleDragEnd = useCallback((e) => {
		e.target.style.opacity = "1";
		setDragItem(null);
		setDragOverTarget(null);
	}, []);

	const handleDragOver = useCallback((e, widgetId, column) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverTarget({ widgetId, column });
	}, []);

	const handleDrop = useCallback((e, targetWidgetId, targetColumn) => {
		e.preventDefault();
		if (!dragItem) return;
		const { widgetId: sourceWidgetId, column: sourceColumn } = dragItem;
		if (sourceWidgetId === targetWidgetId && sourceColumn === targetColumn) return;

		setLayout((prev) => {
			const next = {
				left: [...prev.left],
				center: [...prev.center],
				right: [...prev.right],
			};

			// Remove source from its column
			const srcIdx = next[sourceColumn].indexOf(sourceWidgetId);
			if (srcIdx === -1) return prev;
			next[sourceColumn].splice(srcIdx, 1);

			// Insert at target position
			const tgtIdx = next[targetColumn].indexOf(targetWidgetId);
			if (tgtIdx === -1) {
				next[targetColumn].push(sourceWidgetId);
			} else {
				next[targetColumn].splice(tgtIdx, 0, sourceWidgetId);
			}

			return next;
		});

		setDragItem(null);
		setDragOverTarget(null);
	}, [dragItem]);

	const handleColumnDrop = useCallback((e, column) => {
		e.preventDefault();
		if (!dragItem) return;
		const { widgetId: sourceWidgetId, column: sourceColumn } = dragItem;

		setLayout((prev) => {
			const next = {
				left: [...prev.left],
				center: [...prev.center],
				right: [...prev.right],
			};

			const srcIdx = next[sourceColumn].indexOf(sourceWidgetId);
			if (srcIdx === -1) return prev;
			next[sourceColumn].splice(srcIdx, 1);

			if (!next[column].includes(sourceWidgetId)) {
				next[column].push(sourceWidgetId);
			}

			return next;
		});

		setDragItem(null);
		setDragOverTarget(null);
	}, [dragItem]);

	const renderWidget = (widgetId, column) => {
		let Component = WIDGET_COMPONENTS[widgetId];

		// Handle smart widgets (smart_keyword format)
		if (!Component && widgetId.startsWith("smart_")) {
			const keyword = widgetId.slice(6);
			Component = () => <SmartWidget keyword={keyword} />;
		}

		if (!Component) return null;

		const isOver = dragOverTarget?.widgetId === widgetId && dragOverTarget?.column === column;
		const isDragging = dragItem?.widgetId === widgetId && dragItem?.column === column;

		return (
			<div
				key={widgetId}
				draggable
				onDragStart={(e) => handleDragStart(e, widgetId, column)}
				onDragEnd={handleDragEnd}
				onDragOver={(e) => handleDragOver(e, widgetId, column)}
				onDrop={(e) => handleDrop(e, widgetId, column)}
				className={`transition-all duration-200 cursor-grab active:cursor-grabbing ${
					isOver ? "ring-2 ring-blue-500/50 rounded-2xl" : ""
				} ${isDragging ? "opacity-40" : ""}`}
			>
				<Component />
			</div>
		);
	};

	const renderColumn = (columnId, flexClass) => (
		<div
			className={`${flexClass} min-w-0 flex flex-col gap-6`}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
			}}
			onDrop={(e) => handleColumnDrop(e, columnId)}
		>
			{layout[columnId].map((widgetId) => renderWidget(widgetId, columnId))}
		</div>
	);

	if (!isLoggedIn) return <LoginScreen />;

	return (
		<div
			className={`min-h-screen w-full font-sans overflow-x-hidden relative transition-colors duration-300 ${
				isDark
					? "bg-[#1a1a1a] text-white"
					: "bg-gradient-to-br from-slate-50 via-blue-50 to-white text-slate-800"
			}`}
		>
			<TopNav />

			{/* 3-Column Layout with Drag & Drop */}
			<div className="relative z-10 flex flex-col lg:flex-row gap-8 px-6 pb-6 mt-2 flex-1">
				{renderColumn("left", "flex-1")}
				{renderColumn("center", "flex-1")}
				{renderColumn("right", "flex-[2]")}
			</div>

			{/* Restored components */}
			<FixedButtons />
			<OnboardingModal />
			<SettingsModal />
			<BriefSettingsModal />
		</div>
	);
};

export default App;
===
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
import { useTodoStore } from "./store/useTodoStore";
import { useTheme } from "./hooks/useTheme";
import { supabase } from "./lib/supabase";
import { load, save } from "./utils/storage";

import LoginScreen from "./components/layout/LoginScreen";
import TopNav from "./components/layout/TopNav";
import FixedButtons from "./components/layout/FixedButtons";
import OnboardingModal from "./components/modals/OnboardingModal";
import SettingsModal from "./components/modals/SettingsModal";
import BriefSettingsModal from "./components/modals/BriefSettingsModal";

import BriefingWidget from "./components/widgets/BriefingWidget";
import MiniWidgetGrid from "./components/widgets/MiniWidgetGrid";
import DiaryCard from "./components/widgets/DiaryCard";
import CalendarWidget from "./components/widgets/CalendarWidget";
import WeatherWidget from "./components/widgets/WeatherWidget";
import StocksWidget from "./components/widgets/StocksWidget";
import TrendsWidget from "./components/widgets/TrendsWidget";
import HealthWidget from "./components/widgets/HealthWidget";
import SmartWidgetContent from "./components/widgets/SmartWidgetContent";

/* ── v3: layout key를 col1/col2/col3으로 변경, 캘린더·Todo는 고정 렌더링 ── */
const LAYOUT_VERSION = 3;

const DEFAULT_LAYOUT = {
	col1: ["briefing"],
	col2: ["weather", "health", "diary"],
	col3: ["stocks", "trends", "miniWidgets"],
};

/* 캘린더·Todo는 레이아웃에서 제거 → 별도 고정 렌더링 */
const WIDGET_COMPONENTS = {
	briefing: BriefingWidget,
	miniWidgets: MiniWidgetGrid,
	diary: DiaryCard,
	weather: WeatherWidget,
	stocks: StocksWidget,
	trends: TrendsWidget,
	health: HealthWidget,
};

const WIDGET_LABELS = {
	briefing: "AI 브리핑",
	miniWidgets: "미니 위젯",
	diary: "다이어리",
	weather: "날씨",
	stocks: "주식/환율",
	trends: "실시간 트렌드",
	health: "건강",
};

const initLayout = () => {
	const savedVer = load("mb_widget_layout_ver", 0);
	if (savedVer < LAYOUT_VERSION) {
		save("mb_widget_layout_ver", LAYOUT_VERSION);
		save("mb_widget_layout", DEFAULT_LAYOUT);
		return DEFAULT_LAYOUT;
	}
	return load("mb_widget_layout", DEFAULT_LAYOUT);
};

// Stable wrapper to avoid re-mount on every render
const SmartWidget = ({ keyword }) => <SmartWidgetContent keyword={keyword} />;

const App = () => {
	const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
	const handleAuthChange = useAuthStore((s) => s.handleAuthChange);
	const { isDark } = useTheme();
	const fetchAll = useDataStore((s) => s.fetchAll);
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);

	// Drag & Drop state
	const [layout, setLayout] = useState(initLayout);
	const [dragItem, setDragItem] = useState(null);
	const [dragOverTarget, setDragOverTarget] = useState(null);

	// Supabase auth listener (also handles redirect after OAuth login)
	useEffect(() => {
		if (!supabase) return;
		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			(_event, session) => handleAuthChange(session)
		);
		return () => subscription?.unsubscribe();
	}, [handleAuthChange]);

	// Hydrate stores & fetch data on login
	useEffect(() => {
		if (!isLoggedIn) return;
		const init = async () => {
			try {
				await Promise.all([
					useSettingsStore.getState().hydrateFromDB?.(),
					useWidgetStore.getState().hydrateFromDB?.(),
					useTodoStore.getState().hydrateFromDB?.(),
				]);
			} catch (e) {
				console.warn("Hydrate failed:", e?.message);
			}
			fetchAll();
		};
		init();
	}, [isLoggedIn, fetchAll]);

	// Save layout changes to localStorage
	useEffect(() => {
		save("mb_widget_layout", layout);
	}, [layout]);

	// Sync smart keywords into layout (col2에 추가)
	useEffect(() => {
		if (!smartKeywords?.length) return;
		setLayout((prev) => {
			const allWidgets = [...prev.col1, ...prev.col2, ...prev.col3];
			const newKeys = smartKeywords
				.map((k) => `smart_${k}`)
				.filter((id) => !allWidgets.includes(id));
			if (newKeys.length === 0) return prev;
			return { ...prev, col2: [...prev.col2, ...newKeys] };
		});
	}, [smartKeywords]);

	// ── 드래그 앤 드롭 핸들러 (col1 ↔ col2 ↔ col3 간 자유 이동) ──
	const handleDragStart = useCallback((e, widgetId, column) => {
		setDragItem({ widgetId, column });
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", `${widgetId}|${column}`);
		requestAnimationFrame(() => {
			e.target.style.opacity = "0.4";
		});
	}, []);

	const handleDragEnd = useCallback((e) => {
		e.target.style.opacity = "1";
		setDragItem(null);
		setDragOverTarget(null);
	}, []);

	const handleDragOver = useCallback((e, widgetId, column) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverTarget({ widgetId, column });
	}, []);

	const handleDrop = useCallback((e, targetWidgetId, targetColumn) => {
		e.preventDefault();
		if (!dragItem) return;
		const { widgetId: sourceWidgetId, column: sourceColumn } = dragItem;
		if (sourceWidgetId === targetWidgetId && sourceColumn === targetColumn) return;

		setLayout((prev) => {
			const next = {
				col1: [...prev.col1],
				col2: [...prev.col2],
				col3: [...prev.col3],
			};

			// 소스 열에서 위젯 제거
			const srcIdx = next[sourceColumn].indexOf(sourceWidgetId);
			if (srcIdx === -1) return prev;
			next[sourceColumn].splice(srcIdx, 1);

			// 타겟 위치에 위젯 삽입
			const tgtIdx = next[targetColumn].indexOf(targetWidgetId);
			if (tgtIdx === -1) {
				next[targetColumn].push(sourceWidgetId);
			} else {
				next[targetColumn].splice(tgtIdx, 0, sourceWidgetId);
			}

			return next;
		});

		setDragItem(null);
		setDragOverTarget(null);
	}, [dragItem]);

	const handleColumnDrop = useCallback((e, column) => {
		e.preventDefault();
		if (!dragItem) return;
		const { widgetId: sourceWidgetId, column: sourceColumn } = dragItem;

		setLayout((prev) => {
			const next = {
				col1: [...prev.col1],
				col2: [...prev.col2],
				col3: [...prev.col3],
			};

			const srcIdx = next[sourceColumn].indexOf(sourceWidgetId);
			if (srcIdx === -1) return prev;
			next[sourceColumn].splice(srcIdx, 1);

			if (!next[column].includes(sourceWidgetId)) {
				next[column].push(sourceWidgetId);
			}

			return next;
		});

		setDragItem(null);
		setDragOverTarget(null);
	}, [dragItem]);

	/* 위젯 렌더링 (드래그 가능) */
	const renderWidget = (widgetId, column) => {
		let Component = WIDGET_COMPONENTS[widgetId];

		// Handle smart widgets (smart_keyword format)
		if (!Component && widgetId.startsWith("smart_")) {
			const keyword = widgetId.slice(6);
			Component = () => <SmartWidget keyword={keyword} />;
		}

		if (!Component) return null;

		const isOver = dragOverTarget?.widgetId === widgetId && dragOverTarget?.column === column;
		const isDragging = dragItem?.widgetId === widgetId && dragItem?.column === column;

		return (
			<div
				key={widgetId}
				draggable
				onDragStart={(e) => handleDragStart(e, widgetId, column)}
				onDragEnd={handleDragEnd}
				onDragOver={(e) => handleDragOver(e, widgetId, column)}
				onDrop={(e) => handleDrop(e, widgetId, column)}
				className={`transition-all duration-200 cursor-grab active:cursor-grabbing ${
					isOver ? "ring-2 ring-blue-500/50 rounded-2xl" : ""
				} ${isDragging ? "opacity-40" : ""}`}
			>
				<Component />
			</div>
		);
	};

	/* 드래그 가능한 열 렌더링 (col1/col2/col3) */
	const renderColumn = (columnId, flexClass) => (
		<div
			className={`${flexClass} min-w-0 flex flex-col gap-6`}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
			}}
			onDrop={(e) => handleColumnDrop(e, columnId)}
		>
			{layout[columnId].map((widgetId) => renderWidget(widgetId, columnId))}
		</div>
	);

	if (!isLoggedIn) return <LoginScreen />;

	return (
		<div
			className={`min-h-screen w-full font-sans overflow-x-hidden relative transition-colors duration-300 ${
				isDark
					? "bg-[#1a1a1a] text-white"
					: "bg-gradient-to-br from-slate-50 via-blue-50 to-white text-slate-800"
			}`}
		>
			<TopNav />

			{/* v3: 4열 레이아웃 — col1(1.5) + col2(1) + col3(1) + 캘린더(3, 고정) */}
			<div className="relative z-10 flex flex-col lg:flex-row gap-8 pl-8 pr-8 pb-6 mt-2 flex-1">
				{/* 왼쪽 3열: 위젯 영역 (드래그 앤 드롭 가능) */}
				{renderColumn("col1", "flex-[1.5]")}
				{renderColumn("col2", "flex-1")}
				{renderColumn("col3", "flex-1")}

				{/* 오른쪽: 캘린더 고정 열 (드래그 불가, sticky) */}
				<div className="flex-[3] min-w-0">
					<div className="sticky top-[180px]">
						<CalendarWidget />
					</div>
				</div>
			</div>

			{/* Restored components */}
			<FixedButtons />
			<OnboardingModal />
			<SettingsModal />
			<BriefSettingsModal />
		</div>
	);
};

export default App;

```

### 2. TopNav.jsx — 시계 + 간격 확대
- `text-4xl` → **`text-6xl`**
- `gap-8` → **`gap-12`**

```diff:TopNav.jsx
import { useState, useEffect } from "react";
import { User, Moon, Sun, Search } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import QuickLinks from "./QuickLinks";

const TopNav = () => {
	const { isDark, inputCls } = useTheme();
	const setTheme = useSettingsStore((s) => s.setTheme);

	const [currentTime, setCurrentTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		const t = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	const timeStr = currentTime.toLocaleTimeString("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const handleSearch = (e) => {
		e.preventDefault();
		if (searchQuery.trim())
			window.open(
				`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
				"_blank",
				"noopener,noreferrer",
			);
	};

	return (
		<header className="relative z-10 flex items-center justify-between px-6 pt-10 pb-14">
			{/* Left — Avatar */}
			<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/30">
				<User size={20} className="text-white" />
			</div>

			{/* Center — Clock + Search */}
			<div className="flex flex-col items-center gap-8">
				<h1 className="text-4xl font-light tracking-tighter drop-shadow-lg">
					{timeStr}
				</h1>
				<form onSubmit={handleSearch} className="w-full max-w-md relative group">
					<div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
						<Search
							className={`${isDark ? "text-white/40" : "text-gray-400"} group-focus-within:text-blue-400 transition-colors`}
							size={18}
						/>
					</div>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="검색하거나 AI에게 물어보세요..."
						className={`w-full h-11 backdrop-blur-xl rounded-full pl-10 pr-5 text-sm outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg border ${inputCls}`}
					/>
				</form>
			</div>

			{/* Right — QuickLinks + Theme toggle */}
			<div className="flex items-center gap-2">
				<QuickLinks />
				<button
					onClick={() => setTheme(isDark ? "light" : "dark")}
					className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
						isDark
							? "bg-[#2a2a2a] hover:bg-[#353535] border-[#3a3a3a]"
							: "bg-white/50 hover:bg-white/80 border-gray-200"
					}`}
				>
					{isDark ? <Moon size={18} /> : <Sun size={18} />}
				</button>
			</div>
		</header>
	);
};

export default TopNav;
===
import { useState, useEffect } from "react";
import { User, Moon, Sun, Search } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import QuickLinks from "./QuickLinks";

const TopNav = () => {
	const { isDark, inputCls } = useTheme();
	const setTheme = useSettingsStore((s) => s.setTheme);

	const [currentTime, setCurrentTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		const t = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	const timeStr = currentTime.toLocaleTimeString("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const handleSearch = (e) => {
		e.preventDefault();
		if (searchQuery.trim())
			window.open(
				`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
				"_blank",
				"noopener,noreferrer",
			);
	};

	return (
		<header className="relative z-10 flex items-center justify-between px-6 pt-10 pb-14">
			{/* Left — Avatar */}
			<div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white/30">
				<User size={20} className="text-white" />
			</div>

			{/* Center — Clock + Search */}
			<div className="flex flex-col items-center gap-12">
				<h1 className="text-6xl font-light tracking-tighter drop-shadow-lg">
					{timeStr}
				</h1>
				<form onSubmit={handleSearch} className="w-full max-w-md relative group">
					<div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
						<Search
							className={`${isDark ? "text-white/40" : "text-gray-400"} group-focus-within:text-blue-400 transition-colors`}
							size={18}
						/>
					</div>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="검색하거나 AI에게 물어보세요..."
						className={`w-full h-11 backdrop-blur-xl rounded-full pl-10 pr-5 text-sm outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg border ${inputCls}`}
					/>
				</form>
			</div>

			{/* Right — QuickLinks + Theme toggle */}
			<div className="flex items-center gap-2">
				<QuickLinks />
				<button
					onClick={() => setTheme(isDark ? "light" : "dark")}
					className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
						isDark
							? "bg-[#2a2a2a] hover:bg-[#353535] border-[#3a3a3a]"
							: "bg-white/50 hover:bg-white/80 border-gray-200"
					}`}
				>
					{isDark ? <Moon size={18} /> : <Sun size={18} />}
				</button>
			</div>
		</header>
	);
};

export default TopNav;
```

### 3. QuickLinks.jsx — absolute 오버레이
- `max-w-0` 트랜지션 → **`absolute right-full`** 오버레이
- 호버 시 `backdrop-blur-md bg-white/10 dark:bg-black/20` 효과

```diff:QuickLinks.jsx
import { useState, useRef, useEffect } from "react";
import { Globe, MoreHorizontal, X, Plus, Trash2 } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useQuickLinksStore } from "../../store/useQuickLinksStore";

const QuickLinks = () => {
	const { isDark, cardCls, inputCls } = useTheme();
	const { links, showEditor, setShowEditor, addLink, removeLink, updateLink } =
		useQuickLinksStore();

	const [hovered, setHovered] = useState(false);
	const [newName, setNewName] = useState("");
	const [newUrl, setNewUrl] = useState("");
	const [newIcon, setNewIcon] = useState("");
	const [newColor, setNewColor] = useState("#4285F4");
	const containerRef = useRef(null);
	const editorRef = useRef(null);

	// Close editor on outside click
	useEffect(() => {
		if (!showEditor) return;
		const handler = (e) => {
			if (editorRef.current && !editorRef.current.contains(e.target)) {
				setShowEditor(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showEditor, setShowEditor]);

	const handleAdd = () => {
		if (!newName.trim() || !newUrl.trim()) return;
		let url = newUrl.trim();
		if (!url.startsWith("http")) url = "https://" + url;
		addLink({
			name: newName.trim(),
			url,
			icon: newIcon.trim() || newName.trim().charAt(0).toUpperCase(),
			color: newColor,
		});
		setNewName("");
		setNewUrl("");
		setNewIcon("");
		setNewColor("#4285F4");
	};

	const btnCls = `w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
		isDark
			? "bg-[#2a2a2a] hover:bg-[#353535] border-[#3a3a3a]"
			: "bg-white/50 hover:bg-white/80 border-gray-200"
	}`;

	return (
		<div
			className="relative flex items-center"
			ref={containerRef}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{/* Expanded links - appear on hover, from right to left */}
			<div
				className={`flex items-center gap-1.5 overflow-hidden transition-all duration-300 ease-in-out ${
					hovered ? "max-w-[500px] opacity-100 mr-2" : "max-w-0 opacity-0 mr-0"
				}`}
			>
				{/* Edit button (three dots) */}
				<button
					onClick={(e) => {
						e.stopPropagation();
						setShowEditor(!showEditor);
					}}
					className={btnCls}
					title="즐겨찾기 편집"
				>
					<MoreHorizontal size={16} className="opacity-60" />
				</button>

				{/* Site links */}
				{links.map((link) => (
					<a
						key={link.id}
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						title={link.name}
						className={`w-10 h-10 rounded-full flex items-center justify-center border text-white text-xs font-bold transition-all hover:scale-110 flex-shrink-0`}
						style={{ backgroundColor: link.color, borderColor: link.color }}
					>
						{link.icon}
					</a>
				))}
			</div>

			{/* Main globe icon (always visible) */}
			<button className={btnCls} title="즐겨찾기">
				<Globe size={18} className="opacity-60" />
			</button>

			{/* Editor popup */}
			{showEditor && (
				<div
					ref={editorRef}
					className={`absolute top-12 right-0 w-80 rounded-2xl shadow-2xl border p-4 z-50 ${
						isDark
							? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
							: "bg-white border-gray-200 text-slate-800"
					}`}
				>
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-bold">즐겨찾기 편집</h3>
						<button onClick={() => setShowEditor(false)}>
							<X size={16} className="opacity-60 hover:opacity-100" />
						</button>
					</div>

					{/* Existing links list */}
					<div className="space-y-2 mb-4 max-h-48 overflow-y-auto diary-scroll">
						{links.map((link) => (
							<div
								key={link.id}
								className={`flex items-center gap-2 p-2 rounded-lg ${
									isDark ? "bg-[#333333]" : "bg-gray-50"
								}`}
							>
								<div
									className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
									style={{ backgroundColor: link.color }}
								>
									{link.icon}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-xs font-medium truncate">{link.name}</p>
									<p className="text-[10px] opacity-50 truncate">{link.url}</p>
								</div>
								<button
									onClick={() => removeLink(link.id)}
									className="text-red-400 hover:text-red-300 flex-shrink-0"
								>
									<Trash2 size={14} />
								</button>
							</div>
						))}
					</div>

					{/* Add new link */}
					<div className={`border-t pt-3 ${isDark ? "border-[#444444]" : "border-gray-200"}`}>
						<p className="text-xs font-medium mb-2 opacity-70">새 링크 추가</p>
						<div className="space-y-2">
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="이름 (예: 깃허브)"
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<input
								type="text"
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								placeholder="URL (예: github.com)"
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<div className="flex gap-2">
								<input
									type="text"
									value={newIcon}
									onChange={(e) => setNewIcon(e.target.value)}
									placeholder="아이콘 (예: GH)"
									className={`flex-1 rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
								/>
								<input
									type="color"
									value={newColor}
									onChange={(e) => setNewColor(e.target.value)}
									className="w-8 h-8 rounded-lg border-0 cursor-pointer"
								/>
								<button
									onClick={handleAdd}
									className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
								>
									<Plus size={12} /> 추가
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuickLinks;
===
import { useState, useRef, useEffect } from "react";
import { Globe, MoreHorizontal, X, Plus, Trash2 } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useQuickLinksStore } from "../../store/useQuickLinksStore";

const QuickLinks = () => {
	const { isDark, cardCls, inputCls } = useTheme();
	const { links, showEditor, setShowEditor, addLink, removeLink, updateLink } =
		useQuickLinksStore();

	const [hovered, setHovered] = useState(false);
	const [newName, setNewName] = useState("");
	const [newUrl, setNewUrl] = useState("");
	const [newIcon, setNewIcon] = useState("");
	const [newColor, setNewColor] = useState("#4285F4");
	const containerRef = useRef(null);
	const editorRef = useRef(null);

	// Close editor on outside click
	useEffect(() => {
		if (!showEditor) return;
		const handler = (e) => {
			if (editorRef.current && !editorRef.current.contains(e.target)) {
				setShowEditor(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showEditor, setShowEditor]);

	const handleAdd = () => {
		if (!newName.trim() || !newUrl.trim()) return;
		let url = newUrl.trim();
		if (!url.startsWith("http")) url = "https://" + url;
		addLink({
			name: newName.trim(),
			url,
			icon: newIcon.trim() || newName.trim().charAt(0).toUpperCase(),
			color: newColor,
		});
		setNewName("");
		setNewUrl("");
		setNewIcon("");
		setNewColor("#4285F4");
	};

	const btnCls = `w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
		isDark
			? "bg-[#2a2a2a] hover:bg-[#353535] border-[#3a3a3a]"
			: "bg-white/50 hover:bg-white/80 border-gray-200"
	}`;

	return (
		<div
			className="relative flex items-center"
			ref={containerRef}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{/* 호버 시 왼쪽으로 펼쳐지는 오버레이 — absolute로 시계를 밀지 않음 */}
			<div
				className={`absolute right-full mr-2 flex items-center gap-1.5 overflow-hidden transition-all duration-300 ease-in-out ${
					hovered
						? "max-w-[500px] opacity-100 backdrop-blur-md bg-white/10 dark:bg-black/20 rounded-full px-2 py-1"
						: "max-w-0 opacity-0"
				}`}
			>
				{/* 편집 버튼 */}
				<button
					onClick={(e) => {
						e.stopPropagation();
						setShowEditor(!showEditor);
					}}
					className={btnCls}
					title="즐겨찾기 편집"
				>
					<MoreHorizontal size={16} className="opacity-60" />
				</button>

				{/* 사이트 링크들 */}
				{links.map((link) => (
					<a
						key={link.id}
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						title={link.name}
						className={`w-10 h-10 rounded-full flex items-center justify-center border text-white text-xs font-bold transition-all hover:scale-110 flex-shrink-0`}
						style={{ backgroundColor: link.color, borderColor: link.color }}
					>
						{link.icon}
					</a>
				))}
			</div>

			{/* 메인 지구본 아이콘 (항상 표시) */}
			<button className={btnCls} title="즐겨찾기">
				<Globe size={18} className="opacity-60" />
			</button>

			{/* Editor popup */}
			{showEditor && (
				<div
					ref={editorRef}
					className={`absolute top-12 right-0 w-80 rounded-2xl shadow-2xl border p-4 z-50 ${
						isDark
							? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
							: "bg-white border-gray-200 text-slate-800"
					}`}
				>
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-bold">즐겨찾기 편집</h3>
						<button onClick={() => setShowEditor(false)}>
							<X size={16} className="opacity-60 hover:opacity-100" />
						</button>
					</div>

					{/* Existing links list */}
					<div className="space-y-2 mb-4 max-h-48 overflow-y-auto diary-scroll">
						{links.map((link) => (
							<div
								key={link.id}
								className={`flex items-center gap-2 p-2 rounded-lg ${
									isDark ? "bg-[#333333]" : "bg-gray-50"
								}`}
							>
								<div
									className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
									style={{ backgroundColor: link.color }}
								>
									{link.icon}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-xs font-medium truncate">{link.name}</p>
									<p className="text-[10px] opacity-50 truncate">{link.url}</p>
								</div>
								<button
									onClick={() => removeLink(link.id)}
									className="text-red-400 hover:text-red-300 flex-shrink-0"
								>
									<Trash2 size={14} />
								</button>
							</div>
						))}
					</div>

					{/* Add new link */}
					<div className={`border-t pt-3 ${isDark ? "border-[#444444]" : "border-gray-200"}`}>
						<p className="text-xs font-medium mb-2 opacity-70">새 링크 추가</p>
						<div className="space-y-2">
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="이름 (예: 깃허브)"
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<input
								type="text"
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								placeholder="URL (예: github.com)"
								className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<div className="flex gap-2">
								<input
									type="text"
									value={newIcon}
									onChange={(e) => setNewIcon(e.target.value)}
									placeholder="아이콘 (예: GH)"
									className={`flex-1 rounded-lg px-3 py-1.5 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
								/>
								<input
									type="color"
									value={newColor}
									onChange={(e) => setNewColor(e.target.value)}
									className="w-8 h-8 rounded-lg border-0 cursor-pointer"
								/>
								<button
									onClick={handleAdd}
									className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
								>
									<Plus size={12} /> 추가
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuickLinks;
```

---

## Phase 2: 캘린더 + Todo 통합 (완료 ✅)

### 4. CalendarWidget.jsx — 하단 5:5 분할
- `mockCalendarEvents` → **`useDataStore.calEvents`** 연결
- 하단 영역: 왼쪽 50% (오늘 일정) + 오른쪽 50% (AI Todo)
- **TodoWidget 로직 인라인 통합** (체크/추가/삭제 전부 포함)
- `useTodoStore` 연동 + 일일 리셋

```diff:CalendarWidget.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { Calendar, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { mockCalendarEvents } from "../../mock/data";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const sameDay = (a, b) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const CalendarWidget = () => {
	const { isDark, cardCls, muted } = useTheme();
	const [calView, setCalView] = useState("month");
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentDate, setCurrentDate] = useState(new Date());
	const menuRef = useRef(null);

	const now = new Date();
	const today = now.getDate();
	const viewYear = currentDate.getFullYear();
	const viewMonth = currentDate.getMonth();

	/* Close menu on outside click */
	useEffect(() => {
		if (!menuOpen) return;
		const handler = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target))
				setMenuOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [menuOpen]);

	/* Month navigation */
	const goToPrev = () => {
		setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
	};
	const goToNext = () => {
		setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
	};

	/* Month view cells */
	const cells = useMemo(() => {
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
		const arr = [];
		for (let i = 0; i < firstDayOfWeek; i++) arr.push(null);
		for (let d = 1; d <= daysInMonth; d++) arr.push(d);
		while (arr.length % 7 !== 0) arr.push(null);
		return arr;
	}, [viewYear, viewMonth]);

	/* Week view days */
	const weekDays = useMemo(() => {
		const start = new Date(now);
		start.setDate(now.getDate() - now.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		});
	}, [now.toDateString()]);

	const isCurrentMonth =
		viewYear === now.getFullYear() && viewMonth === now.getMonth();

	const monthLabel = currentDate.toLocaleDateString("ko-KR", {
		year: "numeric",
		month: "long",
	});

	return (
		<div
			className={`h-full rounded-2xl border p-5 shadow-sm transition-colors duration-300 ${cardCls}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Calendar size={18} className="text-blue-500" />
					<h2 className="font-bold text-sm">캘린더</h2>
				</div>

				<div className="flex items-center gap-2">
					{/* Month navigation */}
					{calView === "month" && (
						<>
							<button
								onClick={goToPrev}
								className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
							>
								<ChevronLeft size={16} />
							</button>
							<span className="text-sm font-medium min-w-[100px] text-center">
								{monthLabel}
							</span>
							<button
								onClick={goToNext}
								className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
							>
								<ChevronRight size={16} />
							</button>
						</>
					)}

					{/* Kebab menu */}
					<div ref={menuRef} className="relative">
						<button
							onClick={() => setMenuOpen(!menuOpen)}
							className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
						>
							<MoreVertical size={18} />
						</button>
						{menuOpen && (
							<div
								className={`absolute right-0 mt-2 rounded-lg shadow-lg py-1 z-10 min-w-[80px] border ${
									isDark
										? "bg-[#2a2a2a] border-[#3a3a3a]"
										: "bg-white border-gray-200"
								}`}
							>
								{[
									{ key: "day", label: "일" },
									{ key: "week", label: "주" },
									{ key: "month", label: "월" },
								].map((v) => (
									<button
										key={v.key}
										onClick={() => {
											setCalView(v.key);
											setMenuOpen(false);
										}}
										className={`w-full text-left px-4 py-2 text-sm transition-colors ${
											calView === v.key
												? "text-blue-500 font-medium"
												: isDark
													? "hover:bg-[#353535]"
													: "hover:bg-gray-100"
										}`}
									>
										{v.label}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Month View */}
			{calView === "month" && (
				<div className="grid grid-cols-7 gap-1">
					{DAYS.map((d) => (
						<div
							key={d}
							className={`text-center text-xs font-medium py-2 ${muted}`}
						>
							{d}
						</div>
					))}
					{cells.map((day, i) => (
						<div
							key={i}
							className={`text-center py-2 text-sm rounded-full cursor-default ${
								day === null ? "invisible" : ""
							} ${
								day === today && isCurrentMonth
									? "bg-blue-500 text-white font-bold"
									: isDark
										? "hover:bg-[#353535]"
										: "hover:bg-gray-100"
							}`}
						>
							{day}
						</div>
					))}
				</div>
			)}

			{/* Week View */}
			{calView === "week" && (
				<div className="grid grid-cols-7 gap-2">
					{weekDays.map((d, i) => (
						<div
							key={i}
							className={`text-center p-4 rounded-lg border transition-colors ${
								sameDay(d, now)
									? "bg-blue-500 text-white border-blue-500"
									: isDark
										? "border-[#3a3a3a] hover:bg-[#353535]"
										: "border-gray-200 hover:bg-gray-50"
							}`}
						>
							<p className="text-xs">{DAYS[d.getDay()]}</p>
							<p className="text-lg font-bold">{d.getDate()}</p>
						</div>
					))}
				</div>
			)}

			{/* Day View */}
			{calView === "day" && (
				<div className="flex items-center justify-center py-6">
					<div className="w-40 h-40 rounded-2xl bg-blue-500 text-white flex flex-col items-center justify-center shadow-lg">
						<p className="text-xs uppercase">{DAYS[now.getDay()]}요일</p>
						<p className="text-6xl font-bold">{now.getDate()}</p>
						<p className="text-sm">
							{now.toLocaleDateString("ko-KR", { month: "long" })}
						</p>
					</div>
				</div>
			)}

			{/* Today's events */}
			<div className={`mt-4 pt-4 border-t ${isDark ? "border-[#3a3a3a]" : "border-gray-200"}`}>
				<p className={`text-xs font-medium mb-2 ${muted}`}>오늘 일정</p>
				<div className="space-y-2">
					{mockCalendarEvents.map((ev, i) => (
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
				</div>
			</div>
		</div>
	);
};

export default CalendarWidget;
===
import { useState, useEffect, useRef, useMemo } from "react";
import {
	Calendar,
	MoreVertical,
	ChevronLeft,
	ChevronRight,
	CheckCircle2,
	X,
	Plus,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const sameDay = (a, b) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const CalendarWidget = () => {
	const { isDark, cardCls, muted, inputCls } = useTheme();
	const [calView, setCalView] = useState("month");
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentDate, setCurrentDate] = useState(new Date());
	const menuRef = useRef(null);

	/* ── 외부 스토어 연결 ── */
	const calEvents = useDataStore((s) => s.calEvents) || [];
	const {
		todos,
		newTodoText,
		showAddTodo,
		toggleTodo,
		addTodo,
		deleteTodo,
		ensureDailyReset,
		setNewTodoText,
		setShowAddTodo,
	} = useTodoStore();

	const now = new Date();
	const today = now.getDate();
	const viewYear = currentDate.getFullYear();
	const viewMonth = currentDate.getMonth();

	/* 초기 로드 시 일일 리셋 확인 */
	useEffect(() => {
		ensureDailyReset?.();
	}, [ensureDailyReset]);

	/* Close menu on outside click */
	useEffect(() => {
		if (!menuOpen) return;
		const handler = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target))
				setMenuOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [menuOpen]);

	/* Month navigation */
	const goToPrev = () => {
		setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
	};
	const goToNext = () => {
		setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
	};

	/* Month view cells */
	const cells = useMemo(() => {
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
		const arr = [];
		for (let i = 0; i < firstDayOfWeek; i++) arr.push(null);
		for (let d = 1; d <= daysInMonth; d++) arr.push(d);
		while (arr.length % 7 !== 0) arr.push(null);
		return arr;
	}, [viewYear, viewMonth]);

	/* Week view days */
	const weekDays = useMemo(() => {
		const start = new Date(now);
		start.setDate(now.getDate() - now.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		});
	}, [now.toDateString()]);

	const isCurrentMonth =
		viewYear === now.getFullYear() && viewMonth === now.getMonth();

	const monthLabel = currentDate.toLocaleDateString("ko-KR", {
		year: "numeric",
		month: "long",
	});

	return (
		<div
			className={`h-full rounded-2xl border p-5 shadow-sm transition-colors duration-300 ${cardCls}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Calendar size={18} className="text-blue-500" />
					<h2 className="font-bold text-sm">캘린더</h2>
				</div>

				<div className="flex items-center gap-2">
					{/* Month navigation */}
					{calView === "month" && (
						<>
							<button
								onClick={goToPrev}
								className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
							>
								<ChevronLeft size={16} />
							</button>
							<span className="text-sm font-medium min-w-[100px] text-center">
								{monthLabel}
							</span>
							<button
								onClick={goToNext}
								className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
							>
								<ChevronRight size={16} />
							</button>
						</>
					)}

					{/* Kebab menu */}
					<div ref={menuRef} className="relative">
						<button
							onClick={() => setMenuOpen(!menuOpen)}
							className={`p-1 rounded-full transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
						>
							<MoreVertical size={18} />
						</button>
						{menuOpen && (
							<div
								className={`absolute right-0 mt-2 rounded-lg shadow-lg py-1 z-10 min-w-[80px] border ${
									isDark
										? "bg-[#2a2a2a] border-[#3a3a3a]"
										: "bg-white border-gray-200"
								}`}
							>
								{[
									{ key: "day", label: "일" },
									{ key: "week", label: "주" },
									{ key: "month", label: "월" },
								].map((v) => (
									<button
										key={v.key}
										onClick={() => {
											setCalView(v.key);
											setMenuOpen(false);
										}}
										className={`w-full text-left px-4 py-2 text-sm transition-colors ${
											calView === v.key
												? "text-blue-500 font-medium"
												: isDark
													? "hover:bg-[#353535]"
													: "hover:bg-gray-100"
										}`}
									>
										{v.label}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Month View */}
			{calView === "month" && (
				<div className="grid grid-cols-7 gap-1">
					{DAYS.map((d) => (
						<div
							key={d}
							className={`text-center text-xs font-medium py-2 ${muted}`}
						>
							{d}
						</div>
					))}
					{cells.map((day, i) => (
						<div
							key={i}
							className={`text-center py-2 text-sm rounded-full cursor-pointer ${
								day === null ? "invisible" : ""
							} ${
								day === today && isCurrentMonth
									? "bg-blue-500 text-white font-bold"
									: isDark
										? "hover:bg-[#353535]"
										: "hover:bg-gray-100"
							}`}
						>
							{day}
						</div>
					))}
				</div>
			)}

			{/* Week View */}
			{calView === "week" && (
				<div className="grid grid-cols-7 gap-2">
					{weekDays.map((d, i) => (
						<div
							key={i}
							className={`text-center p-4 rounded-lg border transition-colors ${
								sameDay(d, now)
									? "bg-blue-500 text-white border-blue-500"
									: isDark
										? "border-[#3a3a3a] hover:bg-[#353535]"
										: "border-gray-200 hover:bg-gray-50"
							}`}
						>
							<p className="text-xs">{DAYS[d.getDay()]}</p>
							<p className="text-lg font-bold">{d.getDate()}</p>
						</div>
					))}
				</div>
			)}

			{/* Day View */}
			{calView === "day" && (
				<div className="flex items-center justify-center py-6">
					<div className="w-40 h-40 rounded-2xl bg-blue-500 text-white flex flex-col items-center justify-center shadow-lg">
						<p className="text-xs uppercase">{DAYS[now.getDay()]}요일</p>
						<p className="text-6xl font-bold">{now.getDate()}</p>
						<p className="text-sm">
							{now.toLocaleDateString("ko-KR", { month: "long" })}
						</p>
					</div>
				</div>
			)}

			{/* ── 하단 5:5 분할: 오늘의 일정 + AI Todo ── */}
			<div className={`mt-4 pt-4 border-t ${isDark ? "border-[#3a3a3a]" : "border-gray-200"}`}>
				<div className="flex gap-4">
					{/* 왼쪽: 오늘의 일정 */}
					<div className="flex-1 min-w-0">
						<p className={`text-xs font-medium mb-2 ${muted}`}>오늘 일정</p>
						<div className="space-y-2">
							{calEvents.length === 0 ? (
								<p className={`text-xs ${muted}`}>오늘 일정이 없습니다.</p>
							) : (
								calEvents.map((ev, i) => (
									<div key={i} className="flex items-center gap-3">
										<div
											className="w-1 h-8 rounded-full flex-shrink-0"
											style={{ backgroundColor: ev.color || "#4f46e5" }}
										/>
										<div className="flex-grow min-w-0">
											<p className="text-xs font-medium truncate">
												{ev.title || ev.summary}
											</p>
											<p className={`text-[10px] truncate ${muted}`}>
												{ev.time || ""} {ev.location ? `· ${ev.location}` : ""}
											</p>
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* 오른쪽: AI Todo (기존 TodoWidget 로직 인라인) */}
					<div className="flex-1 min-w-0">
						<p className={`text-xs font-medium mb-2 ${muted}`}>AI Todo</p>
						<div className="space-y-2">
							{todos.map((t) => (
								<div key={t.id} className="flex items-center gap-2 group">
									<button
										onClick={() => toggleTodo(t.id)}
										className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
											t.completed
												? "bg-blue-500 border-blue-500"
												: isDark
													? "border-white/30 hover:border-blue-400"
													: "border-gray-300 hover:border-blue-400"
										}`}
									>
										{t.completed && (
											<CheckCircle2 size={10} className="text-white" />
										)}
									</button>
									<span
										className={`text-xs flex-grow truncate ${
											t.completed ? "line-through opacity-40" : ""
										}`}
									>
										{t.text}
									</span>
									{t.isFixed && (
										<span
											className={`text-[9px] px-1 py-0.5 rounded ${
												isDark
													? "bg-emerald-500/20 text-emerald-300"
													: "bg-emerald-100 text-emerald-700"
											}`}
										>
											루틴
										</span>
									)}
									<button
										onClick={() => deleteTodo(t.id)}
										className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
									>
										<X size={12} />
									</button>
								</div>
							))}

							{/* Todo 추가 UI */}
							{showAddTodo ? (
								<div className="flex items-center gap-1 mt-1">
									<input
										type="text"
										value={newTodoText}
										onChange={(e) => setNewTodoText(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												void addTodo();
											}
										}}
										placeholder="할 일 입력..."
										autoFocus
										className={`flex-grow rounded-lg px-2 py-1 text-xs outline-none border focus:border-blue-400 ${inputCls}`}
									/>
									<button
										onClick={() => void addTodo()}
										className="text-blue-400 text-xs font-medium"
									>
										추가
									</button>
									<button
										onClick={() => {
											setShowAddTodo(false);
											setNewTodoText("");
										}}
									>
										<X size={14} className={muted} />
									</button>
								</div>
							) : (
								<button
									onClick={() => setShowAddTodo(true)}
									className="flex items-center gap-1 text-[10px] text-blue-400 mt-1 hover:underline"
								>
									<Plus size={12} /> 새 할 일
								</button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CalendarWidget;

```

### 5. constants/index.js — todo 항목 제거
- `WIDGET_LIST`, `DEFAULT_VIS`, `DEFAULT_LAYOUTS` 모두에서 `todo` 제거

```diff:index.js
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

export const WIDGET_LIST = [
	{ id: "health", label: "건강 (Google Fit)", category: "core" },
	{ id: "calendar", label: "캘린더 (Google)", category: "core" },
	{ id: "todo", label: "오늘의 할 일", category: "core" },
	{ id: "briefing", label: "AI 브리핑", category: "core" },
	{ id: "trends", label: "실시간 트렌드", category: "core" },
	{ id: "stocks", label: "주식/환율", category: "core" },
	{ id: "weather", label: "날씨", category: "core" },
];

export const DEFAULT_VIS = {
	todo: true,
	health: true,
	briefing: true,
	trends: true,
	stocks: true,
	weather: true,
	calendar: true,
};

export const DEFAULT_LAYOUTS = {
	lg: [
		{ i: "briefing", x: 0, y: 0, w: 3, h: 14, minW: 2, minH: 6 },
		{ i: "calendar", x: 3, y: 0, w: 3, h: 14, minW: 2, minH: 6 },
		{ i: "weather", x: 6, y: 0, w: 3, h: 7, minW: 2, minH: 4 },
		{ i: "stocks", x: 9, y: 0, w: 3, h: 7, minW: 2, minH: 4 },
		{ i: "health", x: 6, y: 7, w: 3, h: 7, minW: 2, minH: 4 },
		{ i: "trends", x: 9, y: 7, w: 3, h: 7, minW: 2, minH: 4 },
		{ i: "todo", x: 0, y: 14, w: 3, h: 7, minW: 2, minH: 4 },
	],
	md: [
		{ i: "briefing", x: 0, y: 0, w: 5, h: 14, minW: 2, minH: 6 },
		{ i: "calendar", x: 5, y: 0, w: 5, h: 14, minW: 2, minH: 6 },
		{ i: "weather", x: 0, y: 14, w: 5, h: 7, minW: 2, minH: 4 },
		{ i: "stocks", x: 5, y: 14, w: 5, h: 7, minW: 2, minH: 4 },
		{ i: "health", x: 0, y: 21, w: 5, h: 7, minW: 2, minH: 4 },
		{ i: "trends", x: 5, y: 21, w: 5, h: 7, minW: 2, minH: 4 },
		{ i: "todo", x: 0, y: 28, w: 10, h: 7, minW: 2, minH: 4 },
	],
	sm: [
		{ i: "briefing", x: 0, y: 0, w: 6, h: 14, minW: 2, minH: 6 },
		{ i: "calendar", x: 0, y: 14, w: 6, h: 14, minW: 2, minH: 6 },
		{ i: "weather", x: 0, y: 28, w: 6, h: 7, minW: 2, minH: 4 },
		{ i: "stocks", x: 0, y: 35, w: 6, h: 7, minW: 2, minH: 4 },
		{ i: "health", x: 0, y: 42, w: 6, h: 7, minW: 2, minH: 4 },
		{ i: "trends", x: 0, y: 49, w: 6, h: 7, minW: 2, minH: 4 },
		{ i: "todo", x: 0, y: 56, w: 6, h: 7, minW: 2, minH: 4 },
	],
};
===
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

export const WIDGET_LIST = [
	{ id: "health", label: "건강 (Google Fit)", category: "core" },
	{ id: "calendar", label: "캘린더 (Google)", category: "core" },
	{ id: "briefing", label: "AI 브리핑", category: "core" },
	{ id: "trends", label: "실시간 트렌드", category: "core" },
	{ id: "stocks", label: "주식/환율", category: "core" },
	{ id: "weather", label: "날씨", category: "core" },
];

export const DEFAULT_VIS = {
	health: true,
	briefing: true,
	trends: true,
	stocks: true,
	weather: true,
	calendar: true,
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
```

### 6. MiniWidgetGrid.jsx — mockTodos → useTodoStore
- `mockTodos` 직접 참조 제거
- `useDataStore(stocks, trends)` + `useTodoStore(todos)` 연결

```diff:MiniWidgetGrid.jsx
import { Sun, TrendingUp, Newspaper, CheckSquare } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import {
	mockWeather,
	mockStocks,
	mockTrends,
	mockTodos,
} from "../../mock/data";

const miniWidgets = [
	{
		icon: Sun,
		label: "날씨",
		value: `${mockWeather.temp}°C`,
		sub: mockWeather.condition,
		color: "text-yellow-500",
	},
	{
		icon: TrendingUp,
		label: mockStocks[0].name,
		value: mockStocks[0].change,
		sub: mockStocks[0].value,
		color: mockStocks[0].up ? "text-green-500" : "text-red-500",
	},
	{
		icon: Newspaper,
		label: "뉴스",
		value: `${mockTrends.length} articles`,
		sub: "실시간 트렌드",
		color: "text-blue-500",
	},
	{
		icon: CheckSquare,
		label: "할 일",
		value: `${mockTodos.filter((t) => !t.completed).length}개 남음`,
		sub: `총 ${mockTodos.length}개`,
		color: "text-purple-500",
	},
];

const MiniWidgetGrid = () => {
	const { cardCls, muted } = useTheme();

	return (
		<div className="grid grid-cols-2 gap-3">
			{miniWidgets.map((w) => (
				<div
					key={w.label}
					className={`rounded-2xl border p-4 shadow-sm transition-colors duration-300 ${cardCls}`}
				>
					<div className="flex items-center gap-2 mb-2">
						<w.icon size={16} className={w.color} />
						<span className={`text-xs ${muted}`}>{w.label}</span>
					</div>
					<p className="text-lg font-bold">{w.value}</p>
					<p className={`text-xs ${muted}`}>{w.sub}</p>
				</div>
			))}
		</div>
	);
};

export default MiniWidgetGrid;
===
import { Sun, TrendingUp, Newspaper, CheckSquare } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import {
	mockWeather,
	mockStocks,
	mockTrends,
} from "../../mock/data";

const MiniWidgetGrid = () => {
	const { cardCls, muted } = useTheme();

	/* 실시간 데이터 (가능한 경우) 또는 mock fallback */
	const storeStocks = useDataStore((s) => s.stocks);
	const storeTrends = useDataStore((s) => s.trends);
	const todos = useTodoStore((s) => s.todos);

	const stocks = storeStocks?.length ? storeStocks : mockStocks;
	const trends = storeTrends?.length ? storeTrends : mockTrends;
	const pendingTodos = todos.filter((t) => !t.completed);

	const miniWidgets = [
		{
			icon: Sun,
			label: "날씨",
			value: `${mockWeather.temp}°C`,
			sub: mockWeather.condition,
			color: "text-yellow-500",
		},
		{
			icon: TrendingUp,
			label: stocks[0]?.name ?? "KOSPI",
			value: stocks[0]?.change ?? "--",
			sub: stocks[0]?.value ?? "--",
			color: stocks[0]?.up ? "text-green-500" : "text-red-500",
		},
		{
			icon: Newspaper,
			label: "뉴스",
			value: `${trends.length} articles`,
			sub: "실시간 트렌드",
			color: "text-blue-500",
		},
		{
			icon: CheckSquare,
			label: "할 일",
			value: `${pendingTodos.length}개 남음`,
			sub: `총 ${todos.length}개`,
			color: "text-purple-500",
		},
	];

	return (
		<div className="grid grid-cols-2 gap-3">
			{miniWidgets.map((w) => (
				<div
					key={w.label}
					className={`rounded-2xl border p-4 shadow-sm transition-colors duration-300 ${cardCls}`}
				>
					<div className="flex items-center gap-2 mb-2">
						<w.icon size={16} className={w.color} />
						<span className={`text-xs ${muted}`}>{w.label}</span>
					</div>
					<p className="text-lg font-bold">{w.value}</p>
					<p className={`text-xs ${muted}`}>{w.sub}</p>
				</div>
			))}
		</div>
	);
};

export default MiniWidgetGrid;

```

---

## Phase 3: 뉴스 모달 (완료 ✅)

### 7. NewsDetailModal.jsx — 신규 생성
- 반투명 블러 오버레이 + 세로 스크롤 뉴스 리스트
- 개별 뉴스 클릭 시 `content` (Tavily API snippet) 확장
- 하단 "원문 보기" 링크

### 8. TrendsWidget.jsx — 모달 연동
- 출처 클릭 시 [NewsDetailModal](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/modals/NewsDetailModal.jsx#5-118) 열림
- `+N건 더 보기` 버튼 추가

```diff:TrendsWidget.jsx
import { TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const formatLastUpdated = (minutes) => {
	if (minutes == null) return "갱신 전";
	if (minutes <= 0) return "방금 갱신";
	return `${minutes}분 전`;
};

const TrendsWidget = () => {
	const { isDark } = useTheme();
	const trends = useDataStore((s) => s.trends);
	const trendsAnswer = useDataStore((s) => s.trendsAnswer);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const loading = useDataStore((s) => s.loading.trends);
	const error = useDataStore((s) => s.errors.trends);
	const rawTrends = useDataStore((s) => s.rawData.trends);
	const fetchTrends = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("trends"));

	return (
		<WidgetCard
			title="실시간 트렌드"
			icon={TrendingUp}
			widgetId="trends"
			headerMeta={lastUpdatedText}
			onRefresh={() => fetchTrends(undefined, true)}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
		>
			{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
			{loading ? (
				<p className="text-sm opacity-60">트렌드 데이터를 불러오는 중...</p>
			) : trends.length === 0 ? (
				<p className="text-sm opacity-60">표시할 트렌드가 없습니다.</p>
			) : (
				<div className="space-y-3">
					{/* AI 요약 */}
					{trendsAnswer && (
						<p className={`text-xs leading-relaxed ${isDark ? "opacity-80" : "text-slate-600"}`}>
							{trendsAnswer}
						</p>
					)}

					{/* 해시태그 */}
					<div className="flex flex-wrap gap-2">
						{trends.map((tag, i) => (
							<span
								key={i}
								className={`text-xs px-3 py-1.5 rounded-lg border ${
									isDark ? "bg-[#333333] border-[#3a3a3a]" : "bg-gray-50 border-gray-200"
								}`}
							>
								{tag}
							</span>
						))}
					</div>

					{/* 출처 목록 */}
					{trendsResults && trendsResults.length > 0 && (
						<div className="space-y-1.5">
							<p className={`text-[11px] font-medium ${isDark ? "opacity-60" : "text-slate-500"}`}>
								출처
							</p>
							{trendsResults.map((r, i) => (
								<a
									key={i}
									href={r.url}
									target="_blank"
									rel="noopener noreferrer"
									className={`flex items-start gap-1.5 p-1.5 rounded-md text-xs transition-colors ${
										isDark
											? "hover:bg-[#333333]"
											: "hover:bg-gray-50"
									}`}
								>
									<ExternalLink size={11} className="mt-0.5 shrink-0 opacity-40" />
									<span className={`line-clamp-1 ${isDark ? "text-blue-300" : "text-blue-600"}`}>
										{r.title || r.url}
									</span>
								</a>
							))}
						</div>
					)}
				</div>
			)}

			<details className="mt-3">
				<summary className="text-[11px] opacity-70 cursor-pointer">
					원본 API 데이터 (tavily)
				</summary>
				<pre
					className={`mt-2 text-[10px] leading-relaxed p-2 rounded-lg overflow-auto max-h-48 ${
						isDark ? "bg-[#222222]" : "bg-gray-100"
					}`}
				>
					{JSON.stringify(rawTrends ?? trends, null, 2)}
				</pre>
			</details>
		</WidgetCard>
	);
};

export default TrendsWidget;
===
import { useState } from "react";
import { TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";
import NewsDetailModal from "../modals/NewsDetailModal";

const formatLastUpdated = (minutes) => {
	if (minutes == null) return "갱신 전";
	if (minutes <= 0) return "방금 갱신";
	return `${minutes}분 전`;
};

const TrendsWidget = () => {
	const { isDark } = useTheme();
	const trends = useDataStore((s) => s.trends);
	const trendsAnswer = useDataStore((s) => s.trendsAnswer);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const loading = useDataStore((s) => s.loading.trends);
	const error = useDataStore((s) => s.errors.trends);
	const fetchTrends = useDataStore((s) => s.fetchTrends);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("trends"));

	/* 뉴스 모달 상태 */
	const [showNewsModal, setShowNewsModal] = useState(false);

	return (
		<>
			<WidgetCard
				title="실시간 트렌드"
				icon={TrendingUp}
				widgetId="trends"
				headerMeta={lastUpdatedText}
				onRefresh={() => fetchTrends(undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
			>
				{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
				{loading ? (
					<p className="text-sm opacity-60">트렌드 데이터를 불러오는 중...</p>
				) : trends.length === 0 ? (
					<p className="text-sm opacity-60">표시할 트렌드가 없습니다.</p>
				) : (
					<div className="space-y-3">
						{/* AI 요약 */}
						{trendsAnswer && (
							<p className={`text-xs leading-relaxed ${isDark ? "opacity-80" : "text-slate-600"}`}>
								{trendsAnswer}
							</p>
						)}

						{/* 해시태그 */}
						<div className="flex flex-wrap gap-2">
							{trends.map((tag, i) => (
								<span
									key={i}
									className={`text-xs px-3 py-1.5 rounded-lg border ${
										isDark ? "bg-[#333333] border-[#3a3a3a]" : "bg-gray-50 border-gray-200"
									}`}
								>
									{tag}
								</span>
							))}
						</div>

						{/* 출처 목록 — 클릭 시 뉴스 모달 열기 */}
						{trendsResults && trendsResults.length > 0 && (
							<div className="space-y-1.5">
								<p className={`text-[11px] font-medium ${isDark ? "opacity-60" : "text-slate-500"}`}>
									출처
								</p>
								{trendsResults.slice(0, 3).map((r, i) => (
									<button
										key={i}
										onClick={() => setShowNewsModal(true)}
										className={`w-full flex items-start gap-1.5 p-1.5 rounded-md text-xs transition-colors text-left ${
											isDark
												? "hover:bg-[#333333]"
												: "hover:bg-gray-50"
										}`}
									>
										<ExternalLink size={11} className="mt-0.5 shrink-0 opacity-40" />
										<span className={`line-clamp-1 ${isDark ? "text-blue-300" : "text-blue-600"}`}>
											{r.title || r.url}
										</span>
									</button>
								))}
								{trendsResults.length > 3 && (
									<button
										onClick={() => setShowNewsModal(true)}
										className="text-[10px] text-blue-400 hover:underline mt-1"
									>
										+{trendsResults.length - 3}건 더 보기
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</WidgetCard>

			{/* 뉴스 상세 모달 */}
			{showNewsModal && (
				<NewsDetailModal
					results={trendsResults || []}
					answer={trendsAnswer || ""}
					onClose={() => setShowNewsModal(false)}
				/>
			)}
		</>
	);
};

export default TrendsWidget;

```

---

## Phase 4: 일기 시스템 (완료 ✅)

### 9. useDiaryStore.js — 신규 생성
- 일기(entries) + 메모(memo) + DiaryCard 답변(diaryAnswers)
- Supabase + localStorage 병행 패턴
- [wasActiveOn()](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/store/useDiaryStore.js#31-38), [markActive()](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/store/useDiaryStore.js#25-30) 접속 관리

### 10. DiaryCard.jsx — useDiaryStore 연동
- `useState` → **`useDiaryStore.addAnswer()`** 전역 공유
- 답변 데이터가 [generateDiary](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/services/aiService.js#415-506)에서 접근 가능

```diff:DiaryCard.jsx
import { useState } from "react";
import { useTheme } from "../../hooks/useTheme";

const DiaryCard = () => {
	const { cardCls, isDark } = useTheme();
	const [diaryText, setDiaryText] = useState("");
	const [savedEntries, setSavedEntries] = useState([]);

	const handleSave = () => {
		if (!diaryText.trim()) return;
		setSavedEntries((prev) => [...prev, { text: diaryText, date: new Date() }]);
		setDiaryText("");
	};

	return (
		<div
			className={`rounded-2xl border p-5 shadow-sm transition-colors duration-300 max-h-[400px] flex flex-col ${cardCls}`}
		>
			<p className="font-bold text-sm mb-3">
				오늘 가장 기분 좋았던 순간은 언제인가요?
			</p>
			<textarea
				className={`w-full h-24 border rounded-lg p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/30 transition-all flex-shrink-0 ${
					isDark
						? "bg-[#333333] border-[#444444] text-white placeholder:text-neutral-500"
						: "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-gray-400"
				}`}
				value={diaryText}
				onChange={(e) => setDiaryText(e.target.value)}
				placeholder="오늘의 이야기를 적어보세요..."
			/>
			<button
				onClick={handleSave}
				className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex-shrink-0"
			>
				확인
			</button>

			{savedEntries.length > 0 && (
				<div className="mt-4 flex-1 min-h-0 overflow-y-auto diary-scroll space-y-2">
					{savedEntries.map((entry, idx) => (
						<div
							key={idx}
							className={`text-xs p-2 rounded-lg ${isDark ? "bg-[#333333]" : "bg-gray-50"}`}
						>
							<p className="opacity-50 text-[10px] mb-1">
								{entry.date.toLocaleTimeString("ko-KR", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</p>
							<p>{entry.text}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default DiaryCard;
===
import { useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";

const todayStr = () => new Date().toISOString().slice(0, 10);

const DiaryCard = () => {
	const { cardCls, isDark } = useTheme();
	const [diaryText, setDiaryText] = useState("");

	/* useDiaryStore에서 오늘 날짜 답변 관리 */
	const addAnswer = useDiaryStore((s) => s.addAnswer);
	const getAnswers = useDiaryStore((s) => s.getAnswers);
	const savedEntries = getAnswers(todayStr());

	const handleSave = () => {
		if (!diaryText.trim()) return;
		addAnswer(todayStr(), diaryText.trim());
		setDiaryText("");
	};

	return (
		<div
			className={`rounded-2xl border p-5 shadow-sm transition-colors duration-300 max-h-[400px] flex flex-col ${cardCls}`}
		>
			<p className="font-bold text-sm mb-3">
				오늘 가장 기분 좋았던 순간은 언제인가요?
			</p>
			<textarea
				className={`w-full h-24 border rounded-lg p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/30 transition-all flex-shrink-0 ${
					isDark
						? "bg-[#333333] border-[#444444] text-white placeholder:text-neutral-500"
						: "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-gray-400"
				}`}
				value={diaryText}
				onChange={(e) => setDiaryText(e.target.value)}
				placeholder="오늘의 이야기를 적어보세요..."
			/>
			<button
				onClick={handleSave}
				className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex-shrink-0"
			>
				확인
			</button>

			{savedEntries.length > 0 && (
				<div className="mt-4 flex-1 min-h-0 overflow-y-auto diary-scroll space-y-2">
					{savedEntries.map((text, idx) => (
						<div
							key={idx}
							className={`text-xs p-2 rounded-lg ${isDark ? "bg-[#333333]" : "bg-gray-50"}`}
						>
							<p>{text}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default DiaryCard;

```

### 11. DiaryModal.jsx — 신규 생성
- 날짜 클릭 시 모달 팝업 (읽기 모드 일기 + 메모 textarea)
- "일기가 아직 생성되지 않았습니다." 빈 상태 처리

### 12. aiService.js — 3개 함수 추가/수정
- [generateBriefing](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/services/aiService.js#307-361): 전날 메모 컨텍스트 포함
- [generateAiTodo(calEvents, existingTodos)](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/services/aiService.js#370-414): 캘린더 기반 Todo 생성
- [generateDiary({...})](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/services/aiService.js#415-506): 접속 O/X 시나리오 분기 일기 생성

```diff:aiService.js
import { supabase } from "../lib/supabase";

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const AI_TIMEOUT_MS = 15000;

const invokeFunction = async (name, body) => {
	if (!supabase) return null;
	const startedAt = Date.now();
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => resolve({ __timeout: true }), AI_TIMEOUT_MS);
	});
	try {
		const result = await Promise.race([
			supabase.functions.invoke(name, { body }),
			timeoutPromise,
		]);
		if (result?.__timeout) {
			console.warn(`[ai] ${name} timed out after ${AI_TIMEOUT_MS}ms`);
			return null;
		}

		const { data, error } = result;
		if (error) throw error;
		if (DEBUG_FLOW) {
			console.log(`[ai] ${name} ok in ${Date.now() - startedAt}ms`);
		}
		return data;
	} catch (error) {
		console.warn(`${name} function failed:`, error.message);
		if (DEBUG_FLOW) {
			console.warn(`[ai] ${name} failed in ${Date.now() - startedAt}ms`);
		}
		return null;
	}
};

const getTimeProfile = (date = new Date()) => {
	const hour = date.getHours();
	if (hour < 11) {
		return {
			mode: "morning",
			label: "아침",
			desc: "동기부여 + 밤사이 뉴스 + 오늘 일정 중심",
			weight: 1.2,
		};
	}
	if (hour >= 11 && hour <= 15) {
		return {
			mode: "lunch",
			label: "점심",
			desc: "메뉴 추천 + 오후 리마인드 + 기상 변화 중심",
			weight: 1.05,
		};
	}
	if (hour >= 18) {
		return {
			mode: "evening",
			label: "저녁",
			desc: "마무리 멘트 + 미완료 Todo + 내일 예고 중심",
			weight: 1.15,
		};
	}
	return {
		mode: "day",
		label: "일반",
		desc: "핵심 변화와 남은 일정 중심",
		weight: 1,
	};
};

const toNum = (v, d = 0) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : d;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const scoreSignals = ({ context, timeProfile }) => {
	const {
		weather,
		stocks,
		trends,
		restaurants,
		calEvents,
		healthData,
		todos,
		activeWidgetIds,
		persona,
	} = context;

	const personaText = [
		persona?.persona,
		persona?.job,
		...(Array.isArray(persona?.interests) ? persona.interests : []),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	const activeSet = new Set(activeWidgetIds || []);

	const signals = [];

	const pushSignal = ({ id, title, payload, R, Kmatch, wPersona, U, Se }) => {
		const wTime = timeProfile.weight;
		const score = R * Kmatch * wPersona + U * wTime + Se;
		signals.push({
			id,
			title,
			payload,
			score: Number(score.toFixed(3)),
			components: { R, Kmatch, wPersona, U, wTime, Se },
		});
	};

	if (activeSet.has("calendar") && Array.isArray(calEvents)) {
		const todayCount = calEvents.length;
		const urgent = calEvents.filter((e) => {
			const start = e?.start ? new Date(e.start).getTime() : NaN;
			if (!Number.isFinite(start)) return false;
			const diffHours = (start - Date.now()) / 3600000;
			return diffHours >= 0 && diffHours <= 4;
		}).length;
		const R = clamp(todayCount / 5, 0.1, 1.2);
		const Kmatch = ["일정", "캘린더", "업무", "meeting", "회의"].some((k) =>
			personaText.includes(k),
		)
			? 1.15
			: 1;
		const wPersona = persona?.job ? 1.1 : 1;
		const U = clamp(urgent / 2, 0, 1.2);
		const Se = timeProfile.mode === "morning" ? 0.35 : 0.15;
		pushSignal({
			id: "calendar",
			title: "오늘 일정",
			payload: calEvents.slice(0, 5),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("todo") && Array.isArray(todos)) {
		const pending = todos.filter((t) => !t.completed);
		const R = clamp(pending.length / 5, 0.1, 1.2);
		const Kmatch = ["생산성", "업무", "공부"].some((k) =>
			personaText.includes(k),
		)
			? 1.15
			: 1;
		const wPersona = 1.05;
		const U = clamp(pending.length / 4, 0, 1.2);
		const Se = timeProfile.mode === "evening" ? 0.4 : 0.2;
		pushSignal({
			id: "todo",
			title: "미완료 할 일",
			payload: pending.slice(0, 5),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("weather") && weather) {
		const temp = toNum(weather.temp, 20);
		const R = clamp(Math.abs(temp - 22) / 12, 0.15, 1.2);
		const Kmatch = ["운동", "외출", "출근"].some((k) => personaText.includes(k))
			? 1.1
			: 1;
		const wPersona = 1;
		const U = clamp(toNum(weather.precipitation, 0) / 60, 0, 1.2);
		const Se = timeProfile.mode === "lunch" ? 0.3 : 0.12;
		pushSignal({
			id: "weather",
			title: "날씨 변화",
			payload: weather,
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("stocks") && Array.isArray(stocks)) {
		const volatility = stocks.reduce((acc, s) => {
			const c = String(s.change ?? "0").replace(/[+,%]/g, "");
			return acc + Math.abs(toNum(c, 0));
		}, 0);
		const R = clamp(volatility / 8, 0.1, 1.2);
		const Kmatch = ["금융", "투자", "경제"].some((k) => personaText.includes(k))
			? 1.2
			: 1;
		const wPersona = ["student", "학생"].some((k) => personaText.includes(k))
			? 0.95
			: 1.1;
		const U = clamp(volatility / 10, 0, 1.2);
		const Se = timeProfile.mode === "morning" ? 0.28 : 0.15;
		pushSignal({
			id: "stocks",
			title: "시장 변동",
			payload: stocks.slice(0, 4),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("trends") && Array.isArray(trends)) {
		const interests = Array.isArray(persona?.interests)
			? persona.interests
			: [];
		const overlap = trends.filter((t) =>
			interests.some((i) =>
				String(t).toLowerCase().includes(String(i).toLowerCase()),
			),
		).length;
		const R = clamp(trends.length / 7, 0.1, 1.2);
		const Kmatch = overlap > 0 ? 1.2 : 1;
		const wPersona = 1.05;
		const U = clamp(overlap / 3, 0, 1.1);
		const Se = timeProfile.mode === "morning" ? 0.25 : 0.1;
		pushSignal({
			id: "trends",
			title: "실시간 트렌드",
			payload: trends.slice(0, 7),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("health") && healthData) {
		const steps = toNum(healthData.steps, 0);
		const R = clamp((10000 - steps) / 10000, 0.1, 1.1);
		const Kmatch = ["건강", "운동", "다이어트"].some((k) =>
			personaText.includes(k),
		)
			? 1.2
			: 1;
		const wPersona = 1.1;
		const U = clamp((7000 - steps) / 7000, 0, 1.2);
		const Se = timeProfile.mode === "evening" ? 0.22 : 0.1;
		pushSignal({
			id: "health",
			title: "오늘 건강 지표",
			payload: healthData,
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("restaurants") && Array.isArray(restaurants)) {
		const R = clamp(restaurants.length / 5, 0.1, 1.1);
		const Kmatch = ["점심", "식단", "음식", "푸드"].some((k) =>
			personaText.includes(k),
		)
			? 1.18
			: 1;
		const wPersona = 1.02;
		const U = timeProfile.mode === "lunch" ? 1 : 0.2;
		const Se = timeProfile.mode === "lunch" ? 0.45 : 0.08;
		pushSignal({
			id: "restaurants",
			title: "메뉴/맛집 추천",
			payload: restaurants.slice(0, 4),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	return signals.sort((a, b) => b.score - a.score).slice(0, 3);
};

const localBriefingFallback = ({ topSignals, timeProfile }) => {
	if (!topSignals.length) {
		return "오늘도 좋은 하루 보내세요.\n중요한 변화는 아직 감지되지 않았어요.\n필요한 위젯을 켜고 새로고침해 최신 브리핑을 받아보세요.";
	}

	const lines = topSignals.map(
		(s) => `• ${s.title}: 핵심 변화를 우선 확인하세요.`,
	);
	while (lines.length < 3) {
		lines.push("• 지금 시점에 맞는 우선 작업부터 하나씩 처리해보세요.");
	}
	return [
		`${timeProfile.label} 브리핑입니다. ${timeProfile.desc}`,
		lines[0],
		lines[1],
	].join("\n");
};

export async function generateBriefing({ tone, length, context }) {
	const timeProfile = getTimeProfile();
	const topSignals = scoreSignals({ context: context ?? {}, timeProfile });
	const contextWithPriority = {
		...(context ?? {}),
		timeProfile,
		topSignals,
		topSignalIds: topSignals.map((s) => s.id),
	};

	const prompt = [
		"당신은 사용자의 시간대별 대시보드 브리핑 AI입니다.",
		`톤: ${tone}`,
		`길이: ${length}`,
		`현재 모드: ${timeProfile.label} (${timeProfile.mode})`,
		`모드 가이드: ${timeProfile.desc}`,
		"우선순위 상위 3개 시그널(topSignals)만 바탕으로 브리핑을 작성하세요.",
		"반드시 정확히 3줄로 작성하세요. 각 줄은 한 문장으로, 불릿/번호/제목 없이 작성하세요.",
		"응답은 순수 텍스트만 작성하세요.",
		JSON.stringify(contextWithPriority, null, 2),
	].join("\n\n");

	const data = await invokeFunction("groq", {
		prompt,
		system: [
			"당신은 개인화된 브리핑 작성기입니다.",
			"아침(11시 이전): 동기부여 + 밤사이 뉴스 + 오늘 일정 중심",
			"점심(11~15시): 메뉴 추천 + 오후 리마인드 + 기상 변화 중심",
			"저녁(18시 이후): 마무리 멘트 + 미완료 Todo + 내일 예고 중심",
			"반드시 정확히 3줄, 한국어, 간결하게 작성하세요.",
		].join("\n"),
	});

	if (!data?.text) {
		return localBriefingFallback({ topSignals, timeProfile });
	}

	const lines = String(data.text)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 3);
	while (lines.length < 3) {
		lines.push("지금 우선순위가 높은 항목부터 짧게 정리해 처리해보세요.");
	}

	return lines.join("\n");
}

export async function generateSmartWidgetData(keyword, context = {}) {
	const data = await invokeFunction("smart-widget", {
		keyword,
		...context,
	});
	return data ?? null;
}
===
import { supabase } from "../lib/supabase";

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const AI_TIMEOUT_MS = 15000;

const invokeFunction = async (name, body) => {
	if (!supabase) return null;
	const startedAt = Date.now();
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => resolve({ __timeout: true }), AI_TIMEOUT_MS);
	});
	try {
		const result = await Promise.race([
			supabase.functions.invoke(name, { body }),
			timeoutPromise,
		]);
		if (result?.__timeout) {
			console.warn(`[ai] ${name} timed out after ${AI_TIMEOUT_MS}ms`);
			return null;
		}

		const { data, error } = result;
		if (error) throw error;
		if (DEBUG_FLOW) {
			console.log(`[ai] ${name} ok in ${Date.now() - startedAt}ms`);
		}
		return data;
	} catch (error) {
		console.warn(`${name} function failed:`, error.message);
		if (DEBUG_FLOW) {
			console.warn(`[ai] ${name} failed in ${Date.now() - startedAt}ms`);
		}
		return null;
	}
};

const getTimeProfile = (date = new Date()) => {
	const hour = date.getHours();
	if (hour < 11) {
		return {
			mode: "morning",
			label: "아침",
			desc: "동기부여 + 밤사이 뉴스 + 오늘 일정 중심",
			weight: 1.2,
		};
	}
	if (hour >= 11 && hour <= 15) {
		return {
			mode: "lunch",
			label: "점심",
			desc: "메뉴 추천 + 오후 리마인드 + 기상 변화 중심",
			weight: 1.05,
		};
	}
	if (hour >= 18) {
		return {
			mode: "evening",
			label: "저녁",
			desc: "마무리 멘트 + 미완료 Todo + 내일 예고 중심",
			weight: 1.15,
		};
	}
	return {
		mode: "day",
		label: "일반",
		desc: "핵심 변화와 남은 일정 중심",
		weight: 1,
	};
};

const toNum = (v, d = 0) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : d;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const scoreSignals = ({ context, timeProfile }) => {
	const {
		weather,
		stocks,
		trends,
		restaurants,
		calEvents,
		healthData,
		todos,
		activeWidgetIds,
		persona,
	} = context;

	const personaText = [
		persona?.persona,
		persona?.job,
		...(Array.isArray(persona?.interests) ? persona.interests : []),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	const activeSet = new Set(activeWidgetIds || []);

	const signals = [];

	const pushSignal = ({ id, title, payload, R, Kmatch, wPersona, U, Se }) => {
		const wTime = timeProfile.weight;
		const score = R * Kmatch * wPersona + U * wTime + Se;
		signals.push({
			id,
			title,
			payload,
			score: Number(score.toFixed(3)),
			components: { R, Kmatch, wPersona, U, wTime, Se },
		});
	};

	if (activeSet.has("calendar") && Array.isArray(calEvents)) {
		const todayCount = calEvents.length;
		const urgent = calEvents.filter((e) => {
			const start = e?.start ? new Date(e.start).getTime() : NaN;
			if (!Number.isFinite(start)) return false;
			const diffHours = (start - Date.now()) / 3600000;
			return diffHours >= 0 && diffHours <= 4;
		}).length;
		const R = clamp(todayCount / 5, 0.1, 1.2);
		const Kmatch = ["일정", "캘린더", "업무", "meeting", "회의"].some((k) =>
			personaText.includes(k),
		)
			? 1.15
			: 1;
		const wPersona = persona?.job ? 1.1 : 1;
		const U = clamp(urgent / 2, 0, 1.2);
		const Se = timeProfile.mode === "morning" ? 0.35 : 0.15;
		pushSignal({
			id: "calendar",
			title: "오늘 일정",
			payload: calEvents.slice(0, 5),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("todo") && Array.isArray(todos)) {
		const pending = todos.filter((t) => !t.completed);
		const R = clamp(pending.length / 5, 0.1, 1.2);
		const Kmatch = ["생산성", "업무", "공부"].some((k) =>
			personaText.includes(k),
		)
			? 1.15
			: 1;
		const wPersona = 1.05;
		const U = clamp(pending.length / 4, 0, 1.2);
		const Se = timeProfile.mode === "evening" ? 0.4 : 0.2;
		pushSignal({
			id: "todo",
			title: "미완료 할 일",
			payload: pending.slice(0, 5),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("weather") && weather) {
		const temp = toNum(weather.temp, 20);
		const R = clamp(Math.abs(temp - 22) / 12, 0.15, 1.2);
		const Kmatch = ["운동", "외출", "출근"].some((k) => personaText.includes(k))
			? 1.1
			: 1;
		const wPersona = 1;
		const U = clamp(toNum(weather.precipitation, 0) / 60, 0, 1.2);
		const Se = timeProfile.mode === "lunch" ? 0.3 : 0.12;
		pushSignal({
			id: "weather",
			title: "날씨 변화",
			payload: weather,
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("stocks") && Array.isArray(stocks)) {
		const volatility = stocks.reduce((acc, s) => {
			const c = String(s.change ?? "0").replace(/[+,%]/g, "");
			return acc + Math.abs(toNum(c, 0));
		}, 0);
		const R = clamp(volatility / 8, 0.1, 1.2);
		const Kmatch = ["금융", "투자", "경제"].some((k) => personaText.includes(k))
			? 1.2
			: 1;
		const wPersona = ["student", "학생"].some((k) => personaText.includes(k))
			? 0.95
			: 1.1;
		const U = clamp(volatility / 10, 0, 1.2);
		const Se = timeProfile.mode === "morning" ? 0.28 : 0.15;
		pushSignal({
			id: "stocks",
			title: "시장 변동",
			payload: stocks.slice(0, 4),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("trends") && Array.isArray(trends)) {
		const interests = Array.isArray(persona?.interests)
			? persona.interests
			: [];
		const overlap = trends.filter((t) =>
			interests.some((i) =>
				String(t).toLowerCase().includes(String(i).toLowerCase()),
			),
		).length;
		const R = clamp(trends.length / 7, 0.1, 1.2);
		const Kmatch = overlap > 0 ? 1.2 : 1;
		const wPersona = 1.05;
		const U = clamp(overlap / 3, 0, 1.1);
		const Se = timeProfile.mode === "morning" ? 0.25 : 0.1;
		pushSignal({
			id: "trends",
			title: "실시간 트렌드",
			payload: trends.slice(0, 7),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("health") && healthData) {
		const steps = toNum(healthData.steps, 0);
		const R = clamp((10000 - steps) / 10000, 0.1, 1.1);
		const Kmatch = ["건강", "운동", "다이어트"].some((k) =>
			personaText.includes(k),
		)
			? 1.2
			: 1;
		const wPersona = 1.1;
		const U = clamp((7000 - steps) / 7000, 0, 1.2);
		const Se = timeProfile.mode === "evening" ? 0.22 : 0.1;
		pushSignal({
			id: "health",
			title: "오늘 건강 지표",
			payload: healthData,
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	if (activeSet.has("restaurants") && Array.isArray(restaurants)) {
		const R = clamp(restaurants.length / 5, 0.1, 1.1);
		const Kmatch = ["점심", "식단", "음식", "푸드"].some((k) =>
			personaText.includes(k),
		)
			? 1.18
			: 1;
		const wPersona = 1.02;
		const U = timeProfile.mode === "lunch" ? 1 : 0.2;
		const Se = timeProfile.mode === "lunch" ? 0.45 : 0.08;
		pushSignal({
			id: "restaurants",
			title: "메뉴/맛집 추천",
			payload: restaurants.slice(0, 4),
			R,
			Kmatch,
			wPersona,
			U,
			Se,
		});
	}

	return signals.sort((a, b) => b.score - a.score).slice(0, 3);
};

const localBriefingFallback = ({ topSignals, timeProfile }) => {
	if (!topSignals.length) {
		return "오늘도 좋은 하루 보내세요.\n중요한 변화는 아직 감지되지 않았어요.\n필요한 위젯을 켜고 새로고침해 최신 브리핑을 받아보세요.";
	}

	const lines = topSignals.map(
		(s) => `• ${s.title}: 핵심 변화를 우선 확인하세요.`,
	);
	while (lines.length < 3) {
		lines.push("• 지금 시점에 맞는 우선 작업부터 하나씩 처리해보세요.");
	}
	return [
		`${timeProfile.label} 브리핑입니다. ${timeProfile.desc}`,
		lines[0],
		lines[1],
	].join("\n");
};

export async function generateBriefing({ tone, length, context }) {
	const timeProfile = getTimeProfile();
	const topSignals = scoreSignals({ context: context ?? {}, timeProfile });
	const contextWithPriority = {
		...(context ?? {}),
		timeProfile,
		topSignals,
		topSignalIds: topSignals.map((s) => s.id),
	};

	const prompt = [
		"당신은 사용자의 시간대별 대시보드 브리핑 AI입니다.",
		`톤: ${tone}`,
		`길이: ${length}`,
		`현재 모드: ${timeProfile.label} (${timeProfile.mode})`,
		`모드 가이드: ${timeProfile.desc}`,
		"우선순위 상위 3개 시그널(topSignals)만 바탕으로 브리핑을 작성하세요.",
		"반드시 정확히 3줄로 작성하세요. 각 줄은 한 문장으로, 불릿/번호/제목 없이 작성하세요.",
		"응답은 순수 텍스트만 작성하세요.",
		// 전날 메모가 있으면 참고 지시 추가
		context?.yesterdayMemo
			? `사용자가 전날 남긴 메모를 참고하여 브리핑에 반영하세요:\n"${context.yesterdayMemo}"`
			: "",
		JSON.stringify(contextWithPriority, null, 2),
	]
		.filter(Boolean)
		.join("\n\n");

	const data = await invokeFunction("groq", {
		prompt,
		system: [
			"당신은 개인화된 브리핑 작성기입니다.",
			"아침(11시 이전): 동기부여 + 밤사이 뉴스 + 오늘 일정 중심",
			"점심(11~15시): 메뉴 추천 + 오후 리마인드 + 기상 변화 중심",
			"저녁(18시 이후): 마무리 멘트 + 미완료 Todo + 내일 예고 중심",
			"반드시 정확히 3줄, 한국어, 간결하게 작성하세요.",
		].join("\n"),
	});

	if (!data?.text) {
		return localBriefingFallback({ topSignals, timeProfile });
	}

	const lines = String(data.text)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 3);
	while (lines.length < 3) {
		lines.push("지금 우선순위가 높은 항목부터 짧게 정리해 처리해보세요.");
	}

	return lines.join("\n");
}

export async function generateSmartWidgetData(keyword, context = {}) {
	const data = await invokeFunction("smart-widget", {
		keyword,
		...context,
	});
	return data ?? null;
}

/**
 * AI 최적화 To-do 생성 — 캘린더 일정 기반
 * @param {Array} calEvents - 오늘의 캘린더 일정 배열
 * @param {Array} existingTodos - 기존 Todo 배열
 * @returns {Array} AI가 추천하는 Todo 배열 [{ text, isFixed }]
 */
export async function generateAiTodo(calEvents = [], existingTodos = []) {
	const prompt = [
		"사용자의 오늘 캘린더 일정을 분석하여 최적의 할 일 목록을 생성하세요.",
		"기존 할 일 목록도 참고하여 중복을 피하세요.",
		"",
		"오늘 일정:",
		JSON.stringify(calEvents.slice(0, 10), null, 2),
		"",
		"기존 할 일:",
		JSON.stringify(existingTodos.map((t) => t.text).slice(0, 10), null, 2),
		"",
		"규칙:",
		"- 최대 5개의 할 일을 제안하세요.",
		"- 각 항목은 간결한 한 문장으로 작성하세요.",
		"- JSON 배열 형식으로 반환하세요: [{\"text\": \"...\"}]",
		"- JSON만 반환하고 다른 텍스트는 작성하지 마세요.",
	].join("\n");

	const data = await invokeFunction("groq", {
		prompt,
		system: "캘린더 일정을 분석하여 최적의 할 일을 추천하는 AI입니다. JSON 배열만 반환하세요.",
	});

	if (!data?.text) return [];

	try {
		const parsed = JSON.parse(data.text);
		if (Array.isArray(parsed)) {
			return parsed.slice(0, 5).map((item) => ({
				text: item.text || item,
				isFixed: false,
			}));
		}
	} catch {
		console.warn("AI Todo 파싱 실패:", data.text);
	}
	return [];
}

/**
 * AI 일기 자동 생성
 * @param {Object} params
 * @param {string} params.briefingText - 당일 AI 브리핑 (시나리오 A만)
 * @param {Array} params.completedTodos - 완료된 Todo 리스트 (시나리오 A만)
 * @param {Object} params.weather - 날씨 데이터
 * @param {Array} params.trends - 뉴스/트렌드 요약
 * @param {Array} params.stocks - 증시/환율 데이터
 * @param {Array} params.calEvents - 캘린더 일정
 * @param {Array} params.diaryAnswers - DiaryCard 질문 답변 (시나리오 A만)
 * @param {string} params.date - 대상 날짜 (YYYY-MM-DD)
 * @param {boolean} params.wasActiveDay - true=접속했음(A), false=비접속(B)
 * @returns {string} 일기 텍스트
 */
export async function generateDiary({
	briefingText = "",
	completedTodos = [],
	weather = null,
	trends = [],
	stocks = [],
	calEvents = [],
	diaryAnswers = [],
	date = "",
	wasActiveDay = false,
}) {
	let prompt;

	if (wasActiveDay) {
		// 시나리오 A: 풍부한 데이터 기반 일기
		prompt = [
			`${date}의 하루를 요약하는 일기를 작성해 주세요.`,
			"",
			"=== 사용자 활동 데이터 ===",
			briefingText ? `AI 브리핑:\n${briefingText}` : "",
			completedTodos.length > 0
				? `완료한 할 일:\n${completedTodos.map((t) => `- ${t.text || t}`).join("\n")}`
				: "",
			diaryAnswers.length > 0
				? `사용자 답변:\n${diaryAnswers.join("\n")}`
				: "",
			"",
			"=== 당일 사실 데이터 ===",
			weather ? `날씨: ${JSON.stringify(weather)}` : "",
			trends.length > 0 ? `트렌드: ${trends.slice(0, 5).join(", ")}` : "",
			stocks.length > 0 ? `증시: ${JSON.stringify(stocks.slice(0, 4))}` : "",
			calEvents.length > 0
				? `일정:\n${calEvents.slice(0, 5).map((e) => `- ${e.title || e.summary}`).join("\n")}`
				: "",
			"",
			"규칙:",
			"- 3~5문장으로 따뜻하고 회고적인 톤으로 작성하세요.",
			"- 한국어로 작성하세요.",
			"- 거시적 사건과 개인 활동을 자연스럽게 엮어 주세요.",
		]
			.filter(Boolean)
			.join("\n");
	} else {
		// 시나리오 B: 사실 기반 간결 일기
		prompt = [
			`${date}에 있었던 사실을 간결히 기록해 주세요.`,
			"(사용자가 이 날 앱에 접속하지 않아 개인 활동 데이터가 없습니다.)",
			"",
			weather ? `날씨: ${JSON.stringify(weather)}` : "",
			trends.length > 0 ? `트렌드: ${trends.slice(0, 5).join(", ")}` : "",
			stocks.length > 0 ? `증시: ${JSON.stringify(stocks.slice(0, 4))}` : "",
			calEvents.length > 0
				? `일정:\n${calEvents.slice(0, 5).map((e) => `- ${e.title || e.summary}`).join("\n")}`
				: "",
			"",
			"규칙:",
			"- 2~3문장으로 사실만 간결하게 기록하세요.",
			"- 한국어로 작성하세요.",
		]
			.filter(Boolean)
			.join("\n");
	}

	const data = await invokeFunction("groq", {
		prompt,
		system: "사용자의 하루를 요약하는 일기를 작성하는 AI입니다. 따뜻하고 자연스러운 한국어로 작성하세요.",
	});

	if (data?.text) {
		return String(data.text).trim();
	}

	// 로컬 fallback
	return wasActiveDay
		? `${date}, 바쁜 하루였습니다. 캘린더에 ${calEvents.length}개의 일정이 있었고, 할 일을 마무리했습니다.`
		: `${date}, 앱에 접속하지 않은 날이었습니다.${calEvents.length > 0 ? ` 캘린더에 ${calEvents.length}개의 일정이 있었습니다.` : ""}`;
}

```

---

## 파일 변경 최종 요약

| 분류 | 파일 | 변경 내용 |
|------|------|-----------|
| 수정 | [App.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/App.jsx) | 4열 레이아웃, 드래그 앤 드롭, 캘린더 sticky |
| 수정 | [TopNav.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/layout/TopNav.jsx) | 시계 크기·간격 |
| 수정 | [QuickLinks.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/layout/QuickLinks.jsx) | absolute 오버레이 |
| 수정 | [CalendarWidget.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/widgets/CalendarWidget.jsx) | 하단 분할, calEvents, Todo 통합 |
| 수정 | [TrendsWidget.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/widgets/TrendsWidget.jsx) | 뉴스 모달 연동 |
| 수정 | [DiaryCard.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/widgets/DiaryCard.jsx) | useDiaryStore 연동 |
| 수정 | [MiniWidgetGrid.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/widgets/MiniWidgetGrid.jsx) | mockTodos 제거, store 연결 |
| 수정 | [aiService.js](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/services/aiService.js) | 3개 AI 함수 추가/수정 |
| 수정 | [constants/index.js](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/constants/index.js) | todo 항목 제거 |
| **신규** | [useDiaryStore.js](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/store/useDiaryStore.js) | 일기/메모/답변 store |
| **신규** | [DiaryModal.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/modals/DiaryModal.jsx) | 일기 확인 + 메모 모달 |
| **신규** | [NewsDetailModal.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/modals/NewsDetailModal.jsx) | 뉴스 상세 모달 |

> [!NOTE]
> [TodoWidget.jsx](file:///c:/Users/okggg/Desktop/CSE%20416/CSE_416_3pip/src/components/widgets/TodoWidget.jsx)는 아직 파일 자체를 삭제하지는 않았습니다. 다만 이미 App.jsx와 constants에서 참조가 제거되어 **사용되지 않는 상태**입니다.
> 완전히 삭제하려면 `git rm src/components/widgets/TodoWidget.jsx`를 실행하세요.
