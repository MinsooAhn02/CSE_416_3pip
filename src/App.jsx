import { useState, useEffect, useRef, useMemo } from "react";
import { ResponsiveGridLayout } from "react-grid-layout";
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

const App = () => {
	/* ── Stores ── */
	const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
	const onboarded = useAuthStore((s) => s.onboarded);
	const setShowOnboarding = useAuthStore((s) => s.setShowOnboarding);

	const bgImage = useSettingsStore((s) => s.bgImage);
	const { isDark, muted, inputCls, cardCls } = useTheme();

	const vis = useWidgetStore((s) => s.vis);
	const layouts = useWidgetStore((s) => s.layouts);
	const editMode = useWidgetStore((s) => s.editMode);
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const handleLayoutChange = useWidgetStore((s) => s.handleLayoutChange);

	const fetchAll = useDataStore((s) => s.fetchAll);

	/* ── Local state ── */
	const [currentTime, setCurrentTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");

	/* ── Refs + grid width ── */
	const gridContainerRef = useRef(null);
	const [gridWidth, setGridWidth] = useState(0);

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
		if (isLoggedIn) fetchAll();
	}, [isLoggedIn, fetchAll]);

	useEffect(() => {
		if (isLoggedIn && !onboarded) setShowOnboarding(true);
	}, [isLoggedIn, onboarded, setShowOnboarding]);

	/* ═══════════ Derived ═══════════ */
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

				{/* Widget Grid */}
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
							{vis.health && (
								<div key="health">
									<HealthWidget />
								</div>
							)}
							{vis.calendar && (
								<div key="calendar">
									<CalendarWidget />
								</div>
							)}
							{vis.todo && (
								<div key="todo">
									<TodoWidget />
								</div>
							)}
							{vis.briefing && (
								<div key="briefing">
									<BriefingWidget />
								</div>
							)}
							{vis.trends && (
								<div key="trends">
									<TrendsWidget />
								</div>
							)}
							{vis.stocks && (
								<div key="stocks">
									<StocksWidget />
								</div>
							)}
							{vis.weather && (
								<div key="weather">
									<WeatherWidget />
								</div>
							)}
							{vis.foodRoulette && (
								<div key="foodRoulette">
									<FoodRouletteWidget />
								</div>
							)}
							{vis.brandDrop && (
								<div key="brandDrop">
									<BrandDropWidget />
								</div>
							)}
							{vis.restaurants && (
								<div key="restaurants">
									<RestaurantsWidget />
								</div>
							)}
							{smartKeywords.map((kw) => (
								<div key={`smart_${kw}`}>
									<div
										className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl h-full overflow-auto ${cardCls}`}
									>
										<SmartWidgetContent keyword={kw} />
									</div>
								</div>
							))}
							<div key="addSmart">
								<AddSmartWidget />
							</div>
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
