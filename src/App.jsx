import { useState, useEffect, useRef, useMemo } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import { Search } from "lucide-react";

import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
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

const ROW_H = 30;
const MARGIN_Y = 16;

const AutoHeight = ({ widgetKey, children }) => {
	const ref = useRef(null);
	const updateWidgetHeight = useWidgetStore((s) => s.updateWidgetHeight);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let timer;
		const ro = new ResizeObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				// Temporarily unset height to measure natural content size
				el.style.height = "auto";
				const px = el.scrollHeight;
				el.style.height = "";
				const h = Math.max(2, Math.ceil((px + MARGIN_Y) / (ROW_H + MARGIN_Y)));
				updateWidgetHeight(widgetKey, h);
			}, 50);
		});
		ro.observe(el);
		return () => {
			clearTimeout(timer);
			ro.disconnect();
		};
	}, [widgetKey, updateWidgetHeight]);

	return (
		<div ref={ref} className="h-full">
			{children}
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
	const { isDark, muted, inputCls, cardCls } = useTheme();

	const vis = useWidgetStore((s) => s.vis);
	const layouts = useWidgetStore((s) => s.layouts);
	const editMode = useWidgetStore((s) => s.editMode);
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const handleLayoutChange = useWidgetStore((s) => s.handleLayoutChange);
	const saveDraggedLayout = useWidgetStore((s) => s.saveDraggedLayout);
	const setCurrentBreakpoint = useWidgetStore((s) => s.setCurrentBreakpoint);

	const fetchAll = useDataStore((s) => s.fetchAll);

	/* ── Local state ── */
	const [currentTime, setCurrentTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");

	/* ── Container width (auto-measured) ── */
	const { containerRef, width: containerWidth } = useContainerWidth();

	/* ═══════════ Effects ═══════════ */
	useEffect(() => {
		const t = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	useEffect(() => {
		if (isLoggedIn) fetchAll();
	}, [isLoggedIn, fetchAll]);

	useEffect(() => {
		if (isLoggedIn && !onboarded) setShowOnboarding(true);
	}, [isLoggedIn, onboarded, setShowOnboarding]);

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
				.map(({ static: _s, ...rest }) => rest);
		}
		return out;
	}, [layouts, visibleKeys]);

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
							rowHeight={30}
							onLayoutChange={handleLayoutChange}
							onBreakpointChange={setCurrentBreakpoint}
							onDragStop={(layout) => saveDraggedLayout(layout)}
							draggableHandle=".drag-handle"
							compactType="vertical"
							margin={[16, 16]}
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
