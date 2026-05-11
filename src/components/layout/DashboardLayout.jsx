import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useDiaryStore } from "../../store/useDiaryStore";
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

/* ── Standard widget registry ── */
const STANDARD_WIDGET_COMPONENTS = {
	weather: WeatherWidget,
	stocks: StocksWidget,
	trends: TrendsWidget,
	health: HealthWidget,
	news: NewsWidget,
};

const SmartWidget = ({ keyword }) => <SmartWidgetContent keyword={keyword} />;

/* Width of the collapsible right panel in px */
const PANEL_W = 292;
const DASHBOARD_VIEWPORT_H = "calc(100vh - 6rem)";

const DashboardLayout = () => {
	const { isDark } = useTheme();
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const vis = useWidgetStore((s) => s.vis);
	const priorityOrder =
		useSettingsStore((s) => s.priorityOrder) || DEFAULT_PRIORITY_ORDER;
	const pinModalVisible = useDiaryStore((s) => s.pinModalVisible);

	/* Panel open/close state — synced with TopNav hamburger via custom event */
	const [panelOpen, setPanelOpen] = useState(true);

	useEffect(() => {
		const handler = (e) => {
			const next = e.detail?.open ?? !panelOpen;
			setPanelOpen(next);
			// Notify TopNav of the actual new state so its icon stays in sync
			window.dispatchEvent(
				new CustomEvent("widget-panel-state", { detail: { open: next } }),
			);
		};
		window.addEventListener("toggle-widget-panel", handler);
		return () => window.removeEventListener("toggle-widget-panel", handler);
	}, [panelOpen]);

	/* Build ordered list of widget IDs (respects priorityOrder + vis) */
	const expandedWidgetOrder = useMemo(() => {
		const list = [];
		priorityOrder.forEach((id) => {
			if (id === "smart") {
				(smartKeywords ?? []).forEach((kw) => list.push(`smart_${kw}`));
				return;
			}
			if (vis[id] === false) return;
			list.push(id);
		});
		return list;
	}, [priorityOrder, smartKeywords, vis]);

	/* Render a single widget by id */
	const renderWidget = useCallback((id) => {
		let Component = STANDARD_WIDGET_COMPONENTS[id];
		if (!Component && id.startsWith("smart_")) {
			const kw = id.slice(6);
			Component = () => <SmartWidget keyword={kw} />;
		}
		if (!Component) return null;
		return (
			<div key={id} className="min-w-0">
				<Component />
			</div>
		);
	}, []);

	return (
		<div
			className="mx-auto w-full max-w-[90vw] px-4 pb-6 mt-1"
			data-widget-overlay-host="true"
		>
			{/* ── Main 3-column layout ── */}
			<div
				className="flex items-start"
				style={{
					gap: panelOpen ? 15 : 0,
					transition: "gap 0.38s cubic-bezier(0.4,0,0.2,1)",
				}}
			>
				{/* ── Col A + B: Briefing+Diary | Calendar ── */}
				<div
					className="flex-1 min-w-0 grid items-start gap-5"
					style={{ gridTemplateColumns: "1.3fr 1.5fr" }}
				>
					{/* Col A: AI Briefing + Diary */}
					<div
						className="flex flex-col gap-5 min-h-0"
						style={{ height: DASHBOARD_VIEWPORT_H }}
					>
						<div className="basis-3/5 min-h-0">
							<BriefingWidget />
						</div>
						<div className="basis-2/5 min-h-0">
							<DiaryCard />
						</div>
					</div>

					{/* Col B: Calendar (sticky) */}
					<div className={`${pinModalVisible ? "" : "sticky top-[3.75rem]"}`}>
						<CalendarWidget />
					</div>
				</div>

				{/* ── Col C: Collapsible widget panel ── */}
				<div
					className="shrink-0 overflow-hidden"
					style={{
						width: panelOpen ? PANEL_W : 0,
						transition: "width 0.38s cubic-bezier(0.4,0,0.2,1)",
						opacity: panelOpen ? 1 : 0,
						transitionProperty: "width, opacity",
					}}
				>
					<div
						className="custom-scrollbar overflow-y-auto flex flex-col gap-3.5 pb-6 pr-0.5"
						style={{
							width: PANEL_W,
							maxHeight: DASHBOARD_VIEWPORT_H,
						}}
					>
						{expandedWidgetOrder.map((id) => renderWidget(id))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default DashboardLayout;
