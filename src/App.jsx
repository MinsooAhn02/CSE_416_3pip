import { useEffect, useState, useCallback, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
import { useTodoStore } from "./store/useTodoStore";
import { useDiaryStore } from "./store/useDiaryStore";
import { useTheme } from "./hooks/useTheme";
import { supabase } from "./lib/supabase";
import { load, save } from "./utils/storage";
import { generateDiary, generateAiTodo } from "./services/aiService";

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

/* ── v5: @hello-pangea/dnd 도입 — 터치 지원, 자유 이동 ── */
const LAYOUT_VERSION = 5;

const DEFAULT_LAYOUT = {
	col1: ["briefing"],
	col2: ["weather", "stocks"],
	col3: ["trends", "health", "diary", "miniWidgets"],
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
	const midnightChecked = useRef(false);

	// Drag & Drop state
	const [layout, setLayout] = useState(initLayout);

	/**
	 * 전날 일기 미생성 시 자동 생성
	 * (브라우저 종료 후 다음 날 접속 시 실행)
	 */
	const checkAndGenerateMissingDiary = async () => {
		const { getDiary, saveDiary, wasActiveOn, markActive } = useDiaryStore.getState();
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().slice(0, 10);

		// 어제 접속했지만 일기가 없으면 생성
		if (wasActiveOn(yesterdayStr) && !getDiary(yesterdayStr)?.diary) {
			try {
				const diaryContext = {
					weather: useDataStore.getState().weather,
					calEvents: useDataStore.getState().calEvents,
					todos: useTodoStore.getState().todos,
				};
				const diaryText = await generateDiary(yesterdayStr, diaryContext);
				if (diaryText) {
					await saveDiary(yesterdayStr, diaryText);
					console.log("[App] 전날 일기 자동 생성 완료:", yesterdayStr);
				}
			} catch (e) {
				console.warn("Auto diary generation failed:", e?.message);
			}
		}

		// 오늘 접속 기록
		markActive();
	};

	/**
	 * 자정 일기 트리거 (브라우저가 열려있을 때만 동작)
	 * TODO: 실시간 업데이트는 추후 예정 - Web Worker 또는 Service Worker 활용 권장
	 */
	useEffect(() => {
		if (!isLoggedIn || midnightChecked.current) return;

		const now = new Date();
		const midnight = new Date(now);
		midnight.setHours(24, 0, 0, 0);
		const msUntilMidnight = midnight.getTime() - now.getTime();

		const timeoutId = setTimeout(async () => {
			midnightChecked.current = true;
			const todayStr = new Date().toISOString().slice(0, 10);
			const { getDiary, saveDiary } = useDiaryStore.getState();

			// 오늘(자정 직전) 일기가 없으면 생성
			if (!getDiary(todayStr)?.diary) {
				try {
					const diaryContext = {
						weather: useDataStore.getState().weather,
						calEvents: useDataStore.getState().calEvents,
						todos: useTodoStore.getState().todos,
					};
					const diaryText = await generateDiary(todayStr, diaryContext);
					if (diaryText) {
						await saveDiary(todayStr, diaryText);
						console.log("[App] 자정 일기 자동 생성 완료:", todayStr);
					}
				} catch (e) {
					console.warn("Midnight diary generation failed:", e?.message);
				}
			}
		}, msUntilMidnight);

		return () => clearTimeout(timeoutId);
	}, [isLoggedIn]);

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
					useDiaryStore.getState().hydrateFromDB?.(),
				]);
			} catch (e) {
				console.warn("Hydrate failed:", e?.message);
			}
			fetchAll();

			// 전날 일기 미생성 확인 및 자동 생성 (실시간 업데이트는 추후 예정)
			checkAndGenerateMissingDiary();

			// AI Todo 자동 생성 (앱 로드 시 1회 실행)
			// TODO: 추후 실시간 업데이트 예정 - 캘린더 일정 변경 시 자동 재생성
			generateAiTodoOnLoad();
		};
		init();
	}, [isLoggedIn, fetchAll]);

	/**
	 * AI Todo 자동 생성 — 앱 로드 시 1회 실행
	 * 캘린더 일정 기반으로 AI가 추천하는 Todo를 생성합니다.
	 * TODO: 추후 실시간 업데이트 예정 - 일정 변경 감지 시 재생성
	 */
	const generateAiTodoOnLoad = async () => {
		const events = useDataStore.getState().calEvents || [];
		const existingTodos = useTodoStore.getState().todos || [];

		// 일정이 없으면 스킵
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

	/**
	 * @hello-pangea/dnd 드래그 종료 핸들러
	 * 모든 드롭 존(col1, col2, col3) 간 자유 이동 지원
	 */
	const handleDragEnd = useCallback((result) => {
		const { source, destination } = result;

		// 드롭 위치가 없으면 무시
		if (!destination) return;

		// 같은 위치에 드롭하면 무시
		if (
			source.droppableId === destination.droppableId &&
			source.index === destination.index
		) {
			return;
		}

		setLayout((prev) => {
			const next = {
				col1: [...prev.col1],
				col2: [...prev.col2],
				col3: [...prev.col3],
			};

			const srcCol = source.droppableId;
			const dstCol = destination.droppableId;

			// 소스 열에서 위젯 제거
			const [removed] = next[srcCol].splice(source.index, 1);

			// 타겟 열에 위젯 삽입
			next[dstCol].splice(destination.index, 0, removed);

			return next;
		});
	}, []);

	/* 위젯 렌더링 (Draggable) */
	const renderWidget = (widgetId, index) => {
		let Component = WIDGET_COMPONENTS[widgetId];

		// Handle smart widgets (smart_keyword format)
		if (!Component && widgetId.startsWith("smart_")) {
			const keyword = widgetId.slice(6);
			Component = () => <SmartWidget keyword={keyword} />;
		}

		if (!Component) return null;

		return (
			<Draggable key={widgetId} draggableId={widgetId} index={index}>
				{(provided, snapshot) => (
					<div
						ref={provided.innerRef}
						{...provided.draggableProps}
						{...provided.dragHandleProps}
						className={`transition-all duration-200 ${
							snapshot.isDragging
								? "ring-2 ring-blue-500 rounded-2xl shadow-2xl opacity-90"
								: ""
						}`}
					>
						<Component />
					</div>
				)}
			</Draggable>
		);
	};

	/* 드롭 가능한 열 렌더링 (Droppable) */
	const renderColumn = (columnId, flexClass) => (
		<Droppable droppableId={columnId}>
			{(provided, snapshot) => (
				<div
					ref={provided.innerRef}
					{...provided.droppableProps}
					className={`${flexClass} min-w-0 flex flex-col gap-6 transition-colors duration-200 rounded-2xl ${
						snapshot.isDraggingOver
							? isDark
								? "bg-blue-500/10"
								: "bg-blue-100/50"
							: ""
					}`}
				>
					{layout[columnId].map((widgetId, index) =>
						renderWidget(widgetId, index)
					)}
					{provided.placeholder}
				</div>
			)}
		</Droppable>
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

			{/* v5: 4열 레이아웃 + @hello-pangea/dnd — col1(1.5) + col2(1) + col3(1) + 캘린더(3, 고정) */}
			<DragDropContext onDragEnd={handleDragEnd}>
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
			</DragDropContext>

			{/* Restored components */}
			<FixedButtons />
			<OnboardingModal />
			<SettingsModal />
			<BriefSettingsModal />
		</div>
	);
};

export default App;
