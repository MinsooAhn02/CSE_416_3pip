import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import { DEFAULT_PRIORITY_ORDER } from "../../constants";

const BriefingWidget = lazy(() => import("../widgets/BriefingWidget"));
const DiaryCard = lazy(() => import("../widgets/DiaryCard"));
const CalendarWidget = lazy(() => import("../widgets/CalendarWidget"));
const WeatherWidget = lazy(() => import("../widgets/WeatherWidget"));
const StocksWidget = lazy(() => import("../widgets/StocksWidget"));
const TrendsWidget = lazy(() => import("../widgets/TrendsWidget"));
const HealthWidget = lazy(() => import("../widgets/HealthWidget"));
const NewsWidget = lazy(() => import("../widgets/NewsWidget"));
const SmartWidgetContent = lazy(() => import("../widgets/SmartWidgetContent"));

/* ── Suspense fallback skeleton ── */
const WidgetSkeleton = () => (
	<div className="animate-pulse rounded-xl h-24 bg-gray-200 dark:bg-gray-700 w-full" />
);

/* ── Standard widget registry ── */
const STANDARD_WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
	weather: WeatherWidget,
	stocks: StocksWidget,
	trends: TrendsWidget,
	health: HealthWidget,
	news: NewsWidget,
};

interface SmartWidgetProps {
	keyword: string;
}

const SmartWidget = ({ keyword }: SmartWidgetProps) => <SmartWidgetContent keyword={keyword} />;

const DASHBOARD_VIEWPORT_H = "calc(100vh - 6rem)";

const DashboardLayout = () => {
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const vis = useWidgetStore((s) => s.vis);
	const priorityOrder =
		useSettingsStore((s) => s.priorityOrder) || DEFAULT_PRIORITY_ORDER;
	const pinModalVisible = useDiaryStore((s) => s.pinModalVisible);

	/* Panel open/close state — synced with TopNav hamburger via custom event */
	const [panelOpen, setPanelOpen] = useState<boolean>(true);

	useEffect(() => {
		const handler = (e: CustomEvent<{ open?: boolean }>) => {
			const next = e.detail?.open ?? !panelOpen;
			setPanelOpen(next);
			// Notify TopNav of the actual new state so its icon stays in sync
			window.dispatchEvent(
				new CustomEvent("widget-panel-state", { detail: { open: next } }),
			);
		};
		window.addEventListener("toggle-widget-panel", handler as EventListener);
		return () => window.removeEventListener("toggle-widget-panel", handler as EventListener);
	}, [panelOpen]);

	// 1200px 경계를 넘을 때만 자동으로 닫고/열기. 매 resize마다 닫으면 좁은 화면에서
	// 사용자가 직접 연 패널이 조금만 창을 움직여도 닫혀버림 (예전 버그: stale panelOpen)
	useEffect(() => {
		let wasNarrow: boolean | null = null;
		const handleResize = () => {
			const narrow = window.innerWidth < 1200;
			if (narrow === wasNarrow) return;
			wasNarrow = narrow;
			setPanelOpen(!narrow);
			window.dispatchEvent(
				new CustomEvent("widget-panel-state", { detail: { open: !narrow } }),
			);
		};
		window.addEventListener("resize", handleResize);
		handleResize(); // 초기 체크
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	/* Build ordered list of widget IDs (respects priorityOrder + vis) */
	const expandedWidgetOrder = useMemo(() => {
		const list: string[] = [];
		const seenSmartKws = new Set<string>();
		priorityOrder.forEach((id: string) => {
			// Legacy: "smart" group entry → expand to all keywords
			if (id === "smart") {
				(smartKeywords ?? []).forEach((kw: string) => {
					if (!seenSmartKws.has(kw)) { seenSmartKws.add(kw); list.push(`smart_${kw}`); }
				});
				return;
			}
			// Individual smart widget entry
			if (id.startsWith("smart_")) {
				const kw = id.slice(6);
				if ((smartKeywords ?? []).includes(kw) && !seenSmartKws.has(kw)) {
					seenSmartKws.add(kw);
					list.push(id);
				}
				return;
			}
			if (vis[id] === false) return;
			list.push(id);
		});
		// Append any smart keywords not yet accounted for
		(smartKeywords ?? []).forEach((kw: string) => {
			if (!seenSmartKws.has(kw)) list.push(`smart_${kw}`);
		});
		return list;
	}, [priorityOrder, smartKeywords, vis]);

	/* Render a single widget by id */
	const renderWidget = useCallback((id: string) => {
		let Component: React.ComponentType | null = STANDARD_WIDGET_COMPONENTS[id] ?? null;
		if (!Component && id.startsWith("smart_")) {
			const kw = id.slice(6);
			Component = () => <SmartWidget keyword={kw} />;
		}
		if (!Component) return null;
		return (
			<div key={id} className="min-w-0">
				<Suspense fallback={<WidgetSkeleton />}>
					<Component />
				</Suspense>
			</div>
		);
	}, []);

	return (
		<div
			className="mx-auto w-full max-w-[90vw] px-4 pb-6 mt-1"
			data-widget-overlay-host="true"
		>
			{/* ── Main 3-column layout: 27% Brief | 44% Calendar | 29% Widgets ── */}
			<div className="flex items-start gap-4">
				{/* Col A: AI Briefing + Diary — flex 2.6 (≈27% when panel open) */}
				<div
					className="flex flex-col gap-5 min-h-0"
					style={{ flex: 2.6, minWidth: 0, height: DASHBOARD_VIEWPORT_H }}
				>
					<div className="basis-3/5 min-h-0">
						<Suspense fallback={<WidgetSkeleton />}>
							<BriefingWidget />
						</Suspense>
					</div>
					<div className="basis-2/5 min-h-0">
						<Suspense fallback={<WidgetSkeleton />}>
							<DiaryCard />
						</Suspense>
					</div>
				</div>

				{/* Col B: Calendar — flex 4.3 (≈44% when panel open) */}
				<div
					className={`min-w-0 ${pinModalVisible ? "" : "sticky top-[3.75rem]"}`}
					style={{ flex: 4.3 }}
				>
					<Suspense fallback={<WidgetSkeleton />}>
						<CalendarWidget />
					</Suspense>
				</div>

				{/* Col C: Collapsible widget panel — 29%, collapses to 0 */}
				<div
					className="overflow-hidden shrink-0"
					style={{
						width: panelOpen ? "29%" : 0,
						maxWidth: panelOpen ? "29%" : 0,
						opacity: panelOpen ? 1 : 0,
						transition: "width 0.38s cubic-bezier(0.4,0,0.2,1), max-width 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.38s cubic-bezier(0.4,0,0.2,1)",
					}}
				>
					<div
						className="custom-scrollbar overflow-y-auto flex flex-col gap-3.5 pb-6 pr-0.5"
						style={{ maxHeight: DASHBOARD_VIEWPORT_H }}
					>
						{expandedWidgetOrder.map((id) => renderWidget(id))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default DashboardLayout;
