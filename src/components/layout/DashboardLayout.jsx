import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useDataStore } from "../../store/useDataStore";
import { DEFAULT_PRIORITY_ORDER } from "../../constants";

import BriefingWidget from "../widgets/BriefingWidget";
import DiaryCard from "../widgets/DiaryCard";
import CalendarWidget from "../widgets/CalendarWidget";
import WeatherWidget from "../widgets/WeatherWidget";
import StocksWidget from "../widgets/StocksWidget";
import TrendsWidget from "../widgets/TrendsWidget";
import HealthWidget from "../widgets/HealthWidget";
import NewsWidget from "../widgets/NewsWidget";
import SmartWidgetContent from "../widgets/SmartWidgetContent";

/* ── v8: 1:3:3 Layout Architecture with Widget Scroll Box (REQ-WS-001) ── */

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

const EDGE_HOVER_THRESHOLD = 24;
const EDGE_HOVER_COOLDOWN_MS = 650;

const chunkArray = (items, size) => {
	if (!Array.isArray(items) || items.length === 0) return [];
	const chunks = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
};

const getSmartPayloadWeight = (payload) => {
	if (!payload || typeof payload !== "object") return 0;
	if (!Array.isArray(payload.sections)) return 0;

	return payload.sections.reduce((acc, section) => {
		const bulletCount = Array.isArray(section?.bullets)
			? section.bullets.length
			: 0;
		const itemCount = Array.isArray(section?.items) ? section.items.length : 0;
		const tagCount = Array.isArray(section?.tags) ? section.tags.length : 0;
		return acc + bulletCount + itemCount + tagCount;
	}, 0);
};

const DashboardLayout = () => {
	const { isDark, borderCls } = useTheme();
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const vis = useWidgetStore((s) => s.vis);
	const smartWidgetData = useWidgetStore((s) => s.smartWidgetData);
	const trends = useDataStore((s) => s.trends);
	const trendsResults = useDataStore((s) => s.trendsResults);
	const newsResults = useDataStore((s) => s.newsResults);
	const stocks = useDataStore((s) => s.stocks);
	const priorityOrder =
		useSettingsStore((s) => s.priorityOrder) || DEFAULT_PRIORITY_ORDER;
	const [activePanel, setActivePanel] = useState(0);
	const [cardsPerView, setCardsPerView] = useState(2);
	const lastEdgeTriggerAt = useRef(0);

	const expandedWidgetOrder = useMemo(() => {
		const normalized = [];

		priorityOrder.forEach((widgetId) => {
			if (widgetId === "smart") {
				if (smartKeywords?.length > 0) {
					smartKeywords.forEach((kw) => normalized.push(`smart_${kw}`));
				}
				return;
			}
			// vis[widgetId] === false면 숨김 (X 버튼으로 닫은 위젯)
			if (vis[widgetId] === false) return;
			normalized.push(widgetId);
		});

		return normalized;
	}, [priorityOrder, smartKeywords, vis]);

	const renderStandardWidget = useCallback((widgetId) => {
		let Component = STANDARD_WIDGET_COMPONENTS[widgetId];

		// Handle smart widgets (dynamic AI content)
		if (!Component && widgetId.startsWith("smart_")) {
			const keyword = widgetId.slice(6);
			Component = () => <SmartWidget keyword={keyword} />;
		}

		if (!Component) return null;

		return <Component />;
	}, []);

	const isDenseWidget = useCallback(
		(widgetId) => {
			if (widgetId === "news") return (newsResults?.length || 0) > 5;
			if (widgetId === "trends") {
				const score = (trends?.length || 0) + (trendsResults?.length || 0);
				return score > 7;
			}
			if (widgetId === "stocks") return (stocks?.length || 0) > 4;

			if (widgetId.startsWith("smart_")) {
				const keyword = widgetId.slice(6);
				const payload = smartWidgetData?.[keyword];
				return getSmartPayloadWeight(payload) > 8;
			}

			return false;
		},
		[newsResults, smartWidgetData, stocks, trends, trendsResults],
	);

	const widgetStacks = useMemo(() => {
		const compact = chunkArray(expandedWidgetOrder, 2);
		if (compact.length === 0) return compact;

		const adaptiveStacks = [];
		let carry = [];

		expandedWidgetOrder.forEach((widgetId) => {
			if (isDenseWidget(widgetId)) {
				if (carry.length > 0) {
					adaptiveStacks.push(carry);
					carry = [];
				}
				adaptiveStacks.push([widgetId]);
				return;
			}

			carry.push(widgetId);
			if (carry.length === 2) {
				adaptiveStacks.push(carry);
				carry = [];
			}
		});

		if (carry.length > 0) adaptiveStacks.push(carry);
		return adaptiveStacks;
	}, [expandedWidgetOrder, isDenseWidget]);

	const deckItems = useMemo(() => {
		const baseItems = [
			{
				id: "briefing-pack",
				render: () => (
					<div className="flex min-h-0 flex-col gap-4">
						<BriefingWidget />
						<DiaryCard />
					</div>
				),
			},
		];

		widgetStacks.forEach((widgetGroup, stackIndex) => {
			baseItems.push({
				id: `widget-stack-${stackIndex}`,
				render: () => (
					<div className="flex min-h-0 flex-col gap-4">
						{widgetGroup.map((widgetId) => (
							<div key={`stack-${stackIndex}-${widgetId}`} className="min-h-0">
								{renderStandardWidget(widgetId)}
							</div>
						))}
					</div>
				),
			});
		});

		return baseItems;
	}, [renderStandardWidget, widgetStacks]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mediaQuery = window.matchMedia("(min-width: 1280px)");
		const syncCardsPerView = () => setCardsPerView(mediaQuery.matches ? 2 : 1);

		syncCardsPerView();

		if (typeof mediaQuery.addEventListener === "function") {
			mediaQuery.addEventListener("change", syncCardsPerView);
			return () => mediaQuery.removeEventListener("change", syncCardsPerView);
		}

		mediaQuery.addListener(syncCardsPerView);
		return () => mediaQuery.removeListener(syncCardsPerView);
	}, []);

	const maxStartIndex = Math.max(deckItems.length - cardsPerView, 0);
	const totalPanels = maxStartIndex + 1;

	useEffect(() => {
		setActivePanel((prev) => Math.min(prev, maxStartIndex));
	}, [maxStartIndex]);

	const movePanel = useCallback(
		(delta) => {
			setActivePanel((prev) => {
				const next = prev + delta;
				if (next < 0 || next > maxStartIndex) return prev;
				return next;
			});
		},
		[maxStartIndex],
	);

	const handleWindowEdgeHover = useCallback(
		(event) => {
			const now = Date.now();
			if (now - lastEdgeTriggerAt.current < EDGE_HOVER_COOLDOWN_MS) return;

			const cursorX = event.clientX;
			const isNearLeft = cursorX <= EDGE_HOVER_THRESHOLD;
			const isNearRight = cursorX >= window.innerWidth - EDGE_HOVER_THRESHOLD;

			if (isNearLeft && activePanel > 0) {
				lastEdgeTriggerAt.current = now;
				movePanel(-1);
				return;
			}

			if (isNearRight && activePanel < totalPanels - 1) {
				lastEdgeTriggerAt.current = now;
				movePanel(1);
			}
		},
		[activePanel, movePanel, totalPanels],
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.addEventListener("mousemove", handleWindowEdgeHover);
		return () => window.removeEventListener("mousemove", handleWindowEdgeHover);
	}, [handleWindowEdgeHover]);

	const dotCount = totalPanels;
	const slideTranslate = activePanel * (100 / cardsPerView);
	const cardBasis = `${100 / cardsPerView}%`;

	return (
		<div className="mx-auto mt-0.5 w-full max-w-[96vw] px-2 pb-20 xl:px-4">
			<div className="grid grid-cols-1 gap-4 pb-2 xl:gap-2 xl:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,0.4fr)] xl:items-start">
				<aside className="min-h-0 pb-3 xl:col-start-2 xl:sticky xl:top-4 xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto custom-scrollbar">
					<CalendarWidget />
				</aside>

				<section
					className="relative min-h-0 pb-3 xl:col-start-3"
					data-widget-overlay-host="true"
				>
					<div className="absolute -top-11 right-2 z-20 flex items-center gap-2 xl:-top-12">
						<button
							type="button"
							onClick={() => movePanel(-1)}
							disabled={activePanel === 0}
							className={`h-9 w-9 rounded-full border flex items-center justify-center transition-all ${
								activePanel === 0
									? "cursor-not-allowed opacity-40"
									: "opacity-90 hover:opacity-100"
							} ${
								isDark
									? `bg-morning-dark-card ${borderCls}`
									: "bg-white border-gray-200"
							}`}
							aria-label="Previous widget panel"
						>
							<ChevronLeft size={16} />
						</button>

						<button
							type="button"
							onClick={() => movePanel(1)}
							disabled={activePanel === totalPanels - 1}
							className={`h-9 w-9 rounded-full border flex items-center justify-center transition-all ${
								activePanel === totalPanels - 1
									? "cursor-not-allowed opacity-40"
									: "opacity-90 hover:opacity-100"
							} ${
								isDark
									? `bg-morning-dark-card ${borderCls}`
									: "bg-white border-gray-200"
							}`}
							aria-label="Next widget panel"
						>
							<ChevronRight size={16} />
						</button>
					</div>

					<div className="overflow-hidden pt-1 pb-2">
						<div
							className="flex transition-transform duration-500 ease-out"
							style={{ transform: `translateX(-${slideTranslate}%)` }}
						>
							{deckItems.map((item) => (
								<section
									key={item.id}
									className="min-h-0 min-w-0 flex-shrink-0 px-2"
									style={{
										width: cardBasis,
										maxWidth: cardBasis,
										flexBasis: cardBasis,
									}}
								>
									{item.render()}
								</section>
							))}
						</div>
					</div>
				</section>
			</div>

			<div className="mt-4 flex items-center justify-center gap-2">
				{Array.from({ length: dotCount }).map((_, i) => (
					<button
						key={`carousel-dot-${i}`}
						onClick={() => setActivePanel(i)}
						className={`h-2.5 rounded-full transition-all ${activePanel === i ? "w-6 bg-blue-500" : isDark ? "w-2.5 bg-gray-600" : "w-2.5 bg-gray-300"}`}
						aria-label={`Go to panel ${i + 1}`}
					/>
				))}
			</div>
		</div>
	);
};

export default DashboardLayout;
