import { useState, useEffect, useRef, useMemo } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import { Search } from "lucide-react";

import { supabase } from "./lib/supabase";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
import { useTodoStore } from "./store/useTodoStore";
import { useTheme } from "./hooks/useTheme";
import { WIDGET_LIST } from "./constants";

import LoginScreen from "./components/layout/LoginScreen";
import TopNav from "./components/layout/TopNav";
import EditModeBanner from "./components/layout/EditModeBanner";
import FixedButtons from "./components/layout/FixedButtons";

import HealthWidget from "./components/widgets/HealthWidget";
import CalendarWidget from "./components/widgets/CalendarWidget";
import TodoWidget from "./components/widgets/TodoWidget";
import BriefingWidget from "./components/widgets/BriefingWidget";
import TrendsWidget from "./components/widgets/TrendsWidget";
import StocksWidget from "./components/widgets/StocksWidget";
import WeatherWidget from "./components/widgets/WeatherWidget";
import FoodRouletteWidget from "./components/widgets/FoodRouletteWidget";
import BrandDropWidget from "./components/widgets/BrandDropWidget";
import RestaurantsWidget from "./components/widgets/RestaurantsWidget";
import SmartWidgetContent from "./components/widgets/SmartWidgetContent";
import AddSmartWidget from "./components/widgets/AddSmartWidget";

import OnboardingModal from "./components/modals/OnboardingModal";
import SettingsModal from "./components/modals/SettingsModal";
import BriefSettingsModal from "./components/modals/BriefSettingsModal";

/* ════════════════════════════════════════════════ */

const ROW_H = 26;
const MARGIN_Y = 10;
const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";

const AutoHeight = ({ widgetKey, children }) => {
	const innerRef = useRef(null);
	const updateWidgetHeight = useWidgetStore((s) => s.updateWidgetHeight);

	useEffect(() => {
		const inner = innerRef.current;
		if (!inner) return;
		let timer;
		const ro = new ResizeObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				// Observe the inner (content-sized) div, not the h-full wrapper.
				// This fires whenever widget content grows (data loads, items added, etc.)
				const px = inner.scrollHeight;
				const h = Math.max(2, Math.ceil((px + MARGIN_Y) / (ROW_H + MARGIN_Y)));
				updateWidgetHeight(widgetKey, h);
			}, 50);
		});
		ro.observe(inner);
		return () => {
			clearTimeout(timer);
			ro.disconnect();
		};
	}, [widgetKey, updateWidgetHeight]);

	return (
		<div className="h-full">
			<div ref={innerRef}>{children}</div>
		</div>
	);
};

const App = () => {
	/* ── Stores ── */
	const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
	const onboarded = useAuthStore((s) => s.onboarded);
	const setShowOnboarding = useAuthStore((s) => s.setShowOnboarding);

	const bgImage = useSettingsStore((s) => s.bgImage);
	const clockStyle = useSettingsStore((s) => s.clockStyle);
	const stockSymbols = useSettingsStore((s) => s.stockSymbols);
	const { isDark, muted, inputCls, cardCls } = useTheme();

	const vis = useWidgetStore((s) => s.vis);
	const layouts = useWidgetStore((s) => s.layouts);
	const editMode = useWidgetStore((s) => s.editMode);
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const handleLayoutChange = useWidgetStore((s) => s.handleLayoutChange);
	const saveDraggedLayout = useWidgetStore((s) => s.saveDraggedLayout);
	const setCurrentBreakpoint = useWidgetStore((s) => s.setCurrentBreakpoint);

	const fetchAll = useDataStore((s) => s.fetchAll);
	const setActiveWidgetIds = useDataStore((s) => s.setActiveWidgetIds);
	const fetchWeather = useDataStore((s) => s.fetchWeather);
	const fetchStocks = useDataStore((s) => s.fetchStocks);
	const fetchTrends = useDataStore((s) => s.fetchTrends);
	const fetchRestaurants = useDataStore((s) => s.fetchRestaurants);
	const fetchCalendar = useDataStore((s) => s.fetchCalendar);
	const fetchHealth = useDataStore((s) => s.fetchHealth);
	const weather = useDataStore((s) => s.weather);
	const stocks = useDataStore((s) => s.stocks);
	const trends = useDataStore((s) => s.trends);
	const restaurants = useDataStore((s) => s.restaurants);
	const calEvents = useDataStore((s) => s.calEvents);
	const healthData = useDataStore((s) => s.healthData);
	const loading = useDataStore((s) => s.loading);

	/* ── Local state ── */
	const [currentTime, setCurrentTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");

	/* ── Container width (auto-measured) ── */
	const { containerRef, width: containerWidth } = useContainerWidth();

	/* ═══════════ Effects ═══════════ */

	/* ── Supabase Auth listener ── */
	useEffect(() => {
		if (!supabase) return;
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_event, session) => {
			if (DEBUG_FLOW) {
				console.log("[flow] onAuthStateChange", {
					event: _event,
					hasSession: !!session,
				});
			}
			const handleAuthChange = useAuthStore.getState().handleAuthChange;
			await handleAuthChange(session);

			if (session) {
				// hydrate all stores from DB in parallel
				if (DEBUG_FLOW) console.log("[flow] hydrate start");
				await Promise.all(
					[
						useSettingsStore.getState().hydrateFromDB?.(),
						useTodoStore.getState().hydrateFromDB?.(),
						useWidgetStore.getState().hydrateFromDB?.(),
					].filter(Boolean),
				);
				if (DEBUG_FLOW) console.log("[flow] hydrate done");
			}
		});
		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		const t = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	useEffect(() => {
		if (!isLoggedIn) return;
		let cancelled = false;
		const run = async () => {
			if (DEBUG_FLOW) console.log("[flow] fetchAll start");
			try {
				await fetchAll();
				if (!cancelled && DEBUG_FLOW) console.log("[flow] fetchAll done");
			} catch (e) {
				if (!cancelled) {
					console.error("[flow] fetchAll failed", e?.message || e);
				}
			}
		};
		run();
		return () => {
			cancelled = true;
		};
	}, [isLoggedIn, fetchAll]);

	useEffect(() => {
		if (isLoggedIn && !onboarded) setShowOnboarding(true);
	}, [isLoggedIn, onboarded, setShowOnboarding]);

	useEffect(() => {
		if (!isLoggedIn) return;

		const activeIds = [
			...Object.keys(vis).filter((key) => vis[key]),
			...smartKeywords.map((kw) => `smart_${kw}`),
		];
		setActiveWidgetIds(activeIds);

		if (vis.weather && !weather && !loading.weather) {
			void fetchWeather();
		}
		if (vis.stocks && stocks.length === 0 && !loading.stocks) {
			void fetchStocks(stockSymbols);
		}
		if (vis.trends && trends.length === 0 && !loading.trends) {
			void fetchTrends();
		}
		if (vis.restaurants && restaurants.length === 0 && !loading.restaurants) {
			void fetchRestaurants();
		}
		if (vis.calendar && calEvents.length === 0 && !loading.calendar) {
			void fetchCalendar();
		}
		if (vis.health && !healthData && !loading.health) {
			void fetchHealth();
		}
	}, [
		isLoggedIn,
		vis,
		smartKeywords,
		weather,
		stocks.length,
		trends.length,
		restaurants.length,
		calEvents.length,
		healthData,
		loading.weather,
		loading.stocks,
		loading.trends,
		loading.restaurants,
		loading.calendar,
		loading.health,
		setActiveWidgetIds,
		fetchWeather,
		fetchStocks,
		stockSymbols,
		fetchTrends,
		fetchRestaurants,
		fetchCalendar,
		fetchHealth,
	]);

	/* ═══════════ Derived ═══════════ */
	const hours = currentTime.getHours();
	const minutes = currentTime.getMinutes();
	const seconds = currentTime.getSeconds();

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
	const dateFullStr = currentTime.toLocaleDateString("ko-KR", {
		year: "numeric",
		month: "long",
		day: "numeric",
		weekday: "long",
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

	/* ═══════════ Computed layout ═══════════ */
	const visibleKeys = useMemo(() => {
		const keys = new Set();
		for (const w of WIDGET_LIST) {
			if (vis[w.id]) keys.add(w.id);
		}
		for (const kw of smartKeywords) keys.add(`smart_${kw}`);
		return keys;
	}, [vis, smartKeywords]);

	const filteredLayouts = useMemo(() => {
		const out = {};
		for (const bp of Object.keys(layouts)) {
			out[bp] = layouts[bp]
				.filter((l) => visibleKeys.has(l.i))
				.map(({ static: _s, ...rest }) => ({ ...rest, static: !editMode }));
		}
		return out;
	}, [layouts, visibleKeys, editMode]);

	/* ═══════════ Login gate ═══════════ */
	if (!isLoggedIn) return <LoginScreen />;

	/* ═══════════ Dashboard ═══════════ */
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

			<TopNav />

			{/* Clock & Search */}
			<div className="relative z-10 flex flex-col items-center pt-1 pb-3 px-6">
				<div className="text-center mb-3">
					{clockStyle === "digital" && (
						<>
							<h1 className="text-7xl font-light tracking-tighter mb-2 drop-shadow-2xl">
								{timeStr}
							</h1>
							<p
								className={`text-base font-medium ${isDark ? "opacity-80" : "text-slate-600"}`}
							>
								{dateStr}
							</p>
						</>
					)}
					{clockStyle === "dateInfo" && (
						<>
							<p
								className={`text-base font-medium mb-1 ${isDark ? "opacity-70" : "text-slate-500"}`}
							>
								{dateFullStr}
							</p>
							<h1 className="text-8xl font-extralight tracking-tight mb-2 drop-shadow-2xl tabular-nums">
								{String(hours).padStart(2, "0")}
								<span className="animate-pulse">:</span>
								{String(minutes).padStart(2, "0")}
								<span className="text-3xl opacity-50 ml-1">
									{String(seconds).padStart(2, "0")}
								</span>
							</h1>
						</>
					)}
					{clockStyle === "analog" && (
						<div className="flex flex-col items-center">
							<svg
								width="160"
								height="160"
								viewBox="0 0 160 160"
								className="drop-shadow-2xl mb-2"
							>
								<circle
									cx="80"
									cy="80"
									r="75"
									fill="none"
									stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}
									strokeWidth="2"
								/>
								{[...Array(12)].map((_, i) => {
									const a = (i * 30 - 90) * (Math.PI / 180);
									const r1 = 62,
										r2 = 70;
									return (
										<line
											key={i}
											x1={80 + r1 * Math.cos(a)}
											y1={80 + r1 * Math.sin(a)}
											x2={80 + r2 * Math.cos(a)}
											y2={80 + r2 * Math.sin(a)}
											stroke={
												isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"
											}
											strokeWidth={i % 3 === 0 ? 3 : 1.5}
											strokeLinecap="round"
										/>
									);
								})}
								{/* Hour hand */}
								<line
									x1="80"
									y1="80"
									x2={
										80 +
										38 *
											Math.cos(
												((((hours % 12) + minutes / 60) * 30 - 90) * Math.PI) /
													180,
											)
									}
									y2={
										80 +
										38 *
											Math.sin(
												((((hours % 12) + minutes / 60) * 30 - 90) * Math.PI) /
													180,
											)
									}
									stroke={isDark ? "#e2e8f0" : "#334155"}
									strokeWidth="3.5"
									strokeLinecap="round"
								/>
								{/* Minute hand */}
								<line
									x1="80"
									y1="80"
									x2={80 + 52 * Math.cos(((minutes * 6 - 90) * Math.PI) / 180)}
									y2={80 + 52 * Math.sin(((minutes * 6 - 90) * Math.PI) / 180)}
									stroke={isDark ? "#93c5fd" : "#3b82f6"}
									strokeWidth="2.5"
									strokeLinecap="round"
								/>
								{/* Second hand */}
								<line
									x1="80"
									y1="80"
									x2={80 + 56 * Math.cos(((seconds * 6 - 90) * Math.PI) / 180)}
									y2={80 + 56 * Math.sin(((seconds * 6 - 90) * Math.PI) / 180)}
									stroke="#ef4444"
									strokeWidth="1"
									strokeLinecap="round"
								/>
								<circle
									cx="80"
									cy="80"
									r="4"
									fill={isDark ? "#93c5fd" : "#3b82f6"}
								/>
							</svg>
							<p
								className={`text-base font-medium ${isDark ? "opacity-80" : "text-slate-600"}`}
							>
								{dateStr}
							</p>
						</div>
					)}
				</div>

				<form
					onSubmit={handleSearch}
					className="w-full max-w-xl relative group mb-4"
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

				{/* Widget Grid */}
				<div className="w-full max-w-[1400px]" ref={containerRef}>
					{containerWidth > 0 && (
						<ResponsiveGridLayout
							width={containerWidth}
							className={`layout ${editMode ? "edit-mode" : ""}`}
							layouts={filteredLayouts}
							breakpoints={{ lg: 1200, md: 900, sm: 600, xs: 0 }}
							cols={{ lg: 12, md: 9, sm: 6, xs: 3 }}
							rowHeight={ROW_H}
							onLayoutChange={handleLayoutChange}
							onBreakpointChange={setCurrentBreakpoint}
							onDragStop={(layout) => saveDraggedLayout(layout)}
							draggableHandle=".drag-handle"
							compactType="vertical"
							margin={[10, MARGIN_Y]}
							isDraggable={editMode}
							isResizable={false}
						>
							{vis.health && (
								<div key="health">
									<AutoHeight widgetKey="health">
										<HealthWidget />
									</AutoHeight>
								</div>
							)}
							{vis.calendar && (
								<div key="calendar">
									<AutoHeight widgetKey="calendar">
										<CalendarWidget />
									</AutoHeight>
								</div>
							)}
							{vis.todo && (
								<div key="todo">
									<AutoHeight widgetKey="todo">
										<TodoWidget />
									</AutoHeight>
								</div>
							)}
							{vis.briefing && (
								<div key="briefing">
									<AutoHeight widgetKey="briefing">
										<BriefingWidget />
									</AutoHeight>
								</div>
							)}
							{vis.trends && (
								<div key="trends">
									<AutoHeight widgetKey="trends">
										<TrendsWidget />
									</AutoHeight>
								</div>
							)}
							{vis.stocks && (
								<div key="stocks">
									<AutoHeight widgetKey="stocks">
										<StocksWidget />
									</AutoHeight>
								</div>
							)}
							{vis.weather && (
								<div key="weather">
									<AutoHeight widgetKey="weather">
										<WeatherWidget />
									</AutoHeight>
								</div>
							)}
							{vis.foodRoulette && (
								<div key="foodRoulette">
									<AutoHeight widgetKey="foodRoulette">
										<FoodRouletteWidget />
									</AutoHeight>
								</div>
							)}
							{vis.brandDrop && (
								<div key="brandDrop">
									<AutoHeight widgetKey="brandDrop">
										<BrandDropWidget />
									</AutoHeight>
								</div>
							)}
							{vis.restaurants && (
								<div key="restaurants">
									<AutoHeight widgetKey="restaurants">
										<RestaurantsWidget />
									</AutoHeight>
								</div>
							)}
							{smartKeywords.map((kw) => (
								<div key={`smart_${kw}`}>
									<AutoHeight widgetKey={`smart_${kw}`}>
										<SmartWidgetContent keyword={kw} />
									</AutoHeight>
								</div>
							))}
						</ResponsiveGridLayout>
					)}
				</div>
			</div>

			<FixedButtons />
			<EditModeBanner />

			{/* Branding */}
			<div className="relative z-10 pb-8 text-center">
				<span
					className={`text-sm font-bold tracking-[0.4em] uppercase ${muted}`}
				>
					MorningBrief.AI
				</span>
			</div>

			<OnboardingModal />
			<SettingsModal />
			<BriefSettingsModal />
		</div>
	);
};

export default App;
