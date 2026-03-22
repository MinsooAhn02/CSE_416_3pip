import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
import { useTodoStore } from "./store/useTodoStore";
import { useDiaryStore } from "./store/useDiaryStore";
import { useTheme } from "./hooks/useTheme";
import { useMidnightTrigger } from "./hooks/useMidnightTrigger";
import { supabase } from "./lib/supabase";
import { load, save } from "./utils/storage";
import { generateAiTodo } from "./services/aiService";
import { STANDARD_WIDGETS, DEFAULT_PRIORITY_ORDER } from "./constants";

import LoginScreen from "./components/layout/LoginScreen";
import TopNav from "./components/layout/TopNav";
import FixedButtons from "./components/layout/FixedButtons";
import OnboardingModal from "./components/modals/OnboardingModal";
import SettingsModal from "./components/modals/SettingsModal";
import BriefSettingsModal from "./components/modals/BriefSettingsModal";
import FirstLoginBriefingModal from "./components/modals/FirstLoginBriefingModal";

import BriefingWidget from "./components/widgets/BriefingWidget";
import NewsWidget from "./components/widgets/NewsWidget";
import DiaryCard from "./components/widgets/DiaryCard";
import CalendarWidget from "./components/widgets/CalendarWidget";
import TodoWidget from "./components/widgets/TodoWidget";
import WeatherWidget from "./components/widgets/WeatherWidget";
import StocksWidget from "./components/widgets/StocksWidget";
import TrendsWidget from "./components/widgets/TrendsWidget";
import HealthWidget from "./components/widgets/HealthWidget";
import SmartWidgetContent from "./components/widgets/SmartWidgetContent";

/* ── v7: 1:3:3 Layout Architecture (REQ-WS-001) ── */
const LAYOUT_VERSION = 7;

// Standard Widgets for Middle Column (REQ-WS-002)
const STANDARD_WIDGET_COMPONENTS = {
	weather: WeatherWidget,
	stocks: StocksWidget,
	trends: TrendsWidget,
	health: HealthWidget,
	news: NewsWidget,
};

// Stable wrapper to avoid re-mount on every render
const SmartWidget = ({ keyword }) => <SmartWidgetContent keyword={keyword} />;

const App = () => {
	const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
	const handleAuthChange = useAuthStore((s) => s.handleAuthChange);
	const { isDark, pageCls } = useTheme();
	const fetchAll = useDataStore((s) => s.fetchAll);
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const priorityOrder = useSettingsStore((s) => s.priorityOrder) || DEFAULT_PRIORITY_ORDER;

	// Use the new midnight trigger hook (REQ-CS-005, REQ-AJ-001)
	useMidnightTrigger(isLoggedIn);

	// Middle Column widget order state (priority-based)
	const [middleWidgetOrder, setMiddleWidgetOrder] = useState(DEFAULT_PRIORITY_ORDER);

	// Update middle column order when priority changes
	useEffect(() => {
		setMiddleWidgetOrder(priorityOrder);
	}, [priorityOrder]);

	// Supabase auth listener
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
					useDiaryStore.getState().hydrateFromDB?.(),
				]);
			} catch (e) {
				console.warn("Hydrate failed:", e?.message);
			}
			fetchAll();
			generateAiTodoOnLoad();
		};
		init();
	}, [isLoggedIn, fetchAll]);

	/**
	 * AI Todo 자동 생성 — 앱 로드 시 1회 실행
	 */
	const generateAiTodoOnLoad = async () => {
		const events = useDataStore.getState().calEvents || [];
		const existingTodos = useTodoStore.getState().todos || [];
		if (events.length === 0) return;

		try {
			const aiTodos = await generateAiTodo(events, existingTodos);
			if (aiTodos.length > 0) {
				await useTodoStore.getState().addAiTodos(aiTodos);
				console.log("[App] AI Todo 자동 생성 완료:", aiTodos.length, "개");
			}
		} catch (e) {
			console.warn("AI Todo generation failed:", e?.message);
		}
	};

	/**
	 * Handle DnD reorder in Middle Column (Standard Widgets only)
	 */
	const handleMiddleDragEnd = useCallback((result) => {
		const { source, destination } = result;
		if (!destination) return;
		if (source.index === destination.index) return;

		setMiddleWidgetOrder((prev) => {
			const next = [...prev];
			const [removed] = next.splice(source.index, 1);
			next.splice(destination.index, 0, removed);
			
			// Save to settings store
			useSettingsStore.getState().setPriorityOrder?.(next);
			return next;
		});
	}, []);

	/**
	 * Render Standard Widget by ID (REQ-WS-002)
	 */
	const renderStandardWidget = useCallback((widgetId, index) => {
		let Component = STANDARD_WIDGET_COMPONENTS[widgetId];

		// Handle smart widgets
		if (!Component && widgetId.startsWith("smart_")) {
			const keyword = widgetId.slice(6);
			Component = () => <SmartWidget keyword={keyword} />;
		}

		// Handle base 'smart' widget
		if (widgetId === "smart" && smartKeywords?.length > 0) {
			return smartKeywords.map((kw, idx) => (
				<Draggable key={`smart_${kw}`} draggableId={`smart_${kw}`} index={index + idx}>
					{(provided, snapshot) => (
						<div
							ref={provided.innerRef}
							{...provided.draggableProps}
							{...provided.dragHandleProps}
							className={snapshot.isDragging ? "ring-2 ring-blue-500 rounded-2xl shadow-2xl opacity-90" : ""}
						>
							<SmartWidget keyword={kw} />
						</div>
					)}
				</Draggable>
			));
		}

		if (!Component) return null;

		return (
			<Draggable key={widgetId} draggableId={widgetId} index={index}>
				{(provided, snapshot) => (
					<div
						ref={provided.innerRef}
						{...provided.draggableProps}
						{...provided.dragHandleProps}
						className={snapshot.isDragging ? "ring-2 ring-blue-500 rounded-2xl shadow-2xl opacity-90" : ""}
						style={{
							...provided.draggableProps.style,
							transition: snapshot.isDragging ? undefined : "box-shadow 0.2s ease, opacity 0.2s ease",
						}}
					>
						<Component />
					</div>
				)}
			</Draggable>
		);
	}, [smartKeywords]);

	if (!isLoggedIn) return <LoginScreen />;

	return (
		<div
			className={`min-h-screen w-full font-sans overflow-x-hidden relative transition-colors duration-300 ${
				isDark
					? "bg-morning-dark-page text-morning-dark-text"
					: "bg-morning-light-page text-morning-light-text"
			}`}
		>
			<TopNav />

			{/* v7: 1:3:3 Dashboard Layout Architecture (REQ-WS-001) */}
			<div className="relative z-10 flex flex-col lg:flex-row gap-3 px-6 lg:px-8 pb-6 mt-2" style={{ minHeight: "calc(100vh - 180px)" }}>
				<div className="hidden lg:flex lg:w-[5%] flex-shrink-0"></div>
				{/* ═══ LEFT COLUMN (Ratio 1) - Fixed Widgets ═══ */}
				<div className="w-full lg:w-[14%] lg:min-w-[200px] flex flex-col gap-6 flex-shrink-0">
					{/* BriefingWidget - Always visible (REQ-WS-002) */}
					<BriefingWidget />
					{/* DiaryCard - Always visible (REQ-WS-002) */}
					<DiaryCard />
				</div>

				{/* ═══ MIDDLE COLUMN (Ratio 3) - Standard Widgets, Independent Scroll ═══ */}
				<DragDropContext onDragEnd={handleMiddleDragEnd}>
					<Droppable droppableId="middleColumn" direction="vertical">
						{(provided, snapshot) => (
							<div
								ref={provided.innerRef}
								{...provided.droppableProps}
								className={`w-full lg:w-[43%] overflow-y-auto rounded-2xl transition-colors duration-200 ${
									snapshot.isDraggingOver
										? isDark ? "bg-blue-500/10" : "bg-blue-100/30"
										: ""
								}`}
								style={{ maxHeight: "calc(100vh - 200px)" }}
							>
								{/* 3 widgets per row grid (REQ-WS-001) */}
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-2">
									{middleWidgetOrder.map((widgetId, index) => 
										renderStandardWidget(widgetId, index)
									)}
									{provided.placeholder}
								</div>
							</div>
						)}
					</Droppable>
				</DragDropContext>

				{/* ═══ RIGHT COLUMN (Ratio 3) - Fixed Widgets ═══ */}
				<div className="w-full lg:w-[43%] flex flex-col gap-6 flex-shrink-0">
					{/* CalendarWidget - Top, fixed height ~60% (REQ-WS-001) */}
					<div className="flex-[6]">
						<CalendarWidget />
					</div>
					{/* TodoWidget - Bottom, flexible (REQ-WS-001) */}
					<div className="flex-[4]">
						<TodoWidget />
					</div>
				</div>
				<div className="hidden lg:flex lg:w-[5%] flex-shrink-0"></div>
			</div>

			{/* Modals & Fixed Components */}
			<FixedButtons />
			<OnboardingModal />
			<SettingsModal />
			<BriefSettingsModal />
			<FirstLoginBriefingModal />
		</div>
	);
};

export default App;
