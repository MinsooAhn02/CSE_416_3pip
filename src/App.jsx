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
