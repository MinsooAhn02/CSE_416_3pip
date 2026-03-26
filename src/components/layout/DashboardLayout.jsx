import { useCallback, useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
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

/**
 * DashboardLayout - 1:3:3 Frame Architecture
 * 
 * Left Column (1): Fixed - BriefingWidget, DiaryCard
 * Middle Column (3): Widget Scroll Box - Standard Widgets (1 per row, full-width)
 * Right Column (3): Fixed - CalendarWidget
 */
const DashboardLayout = () => {
	const { isDark } = useTheme();
	const smartKeywords = useWidgetStore((s) => s.smartKeywords);
	const priorityOrder = useSettingsStore((s) => s.priorityOrder) || DEFAULT_PRIORITY_ORDER;

	// Middle Column widget order state (priority-based, syncs with LLM briefing priority)
	const [middleWidgetOrder, setMiddleWidgetOrder] = useState(DEFAULT_PRIORITY_ORDER);

	// Update middle column order when priority changes
	useEffect(() => {
		setMiddleWidgetOrder(priorityOrder);
	}, [priorityOrder]);

	/**
	 * Handle DnD reorder in Middle Column (Standard Widgets only)
	 * Widget order = LLM Briefing Priority
	 */
	const handleMiddleDragEnd = useCallback((result) => {
		const { source, destination } = result;
		if (!destination) return;
		if (source.index === destination.index) return;

		setMiddleWidgetOrder((prev) => {
			const next = [...prev];
			const [removed] = next.splice(source.index, 1);
			next.splice(destination.index, 0, removed);

			// Save to settings store (syncs with LLM briefing priority)
			useSettingsStore.getState().setPriorityOrder?.(next);
			return next;
		});
	}, []);

	/**
	 * Render Standard Widget by ID (REQ-WS-002)
	 * Each widget occupies 100% width (horizontal wide-card format)
	 */
	const renderStandardWidget = useCallback((widgetId, index) => {
		let Component = STANDARD_WIDGET_COMPONENTS[widgetId];

		// Handle smart widgets (dynamic AI content)
		if (!Component && widgetId.startsWith("smart_")) {
			const keyword = widgetId.slice(6);
			Component = () => <SmartWidget keyword={keyword} />;
		}

		// Handle base 'smart' widget with multiple keywords
		if (widgetId === "smart" && smartKeywords?.length > 0) {
			return smartKeywords.map((kw, idx) => (
				<Draggable key={`smart_${kw}`} draggableId={`smart_${kw}`} index={index + idx}>
					{(provided, snapshot) => (
						<div
							ref={provided.innerRef}
							{...provided.draggableProps}
							{...provided.dragHandleProps}
							className={`w-full ${snapshot.isDragging ? "ring-2 ring-blue-500 rounded-2xl shadow-2xl opacity-90" : ""}`}
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
						className={`w-full ${snapshot.isDragging ? "ring-2 ring-blue-500 rounded-2xl shadow-2xl opacity-90" : ""}`}
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

	// Theme-based card styles
	const cardBg = isDark ? "bg-morning-dark-card" : "bg-morning-light-card";
	const scrollBoxBg = isDark ? "bg-morning-dark-cardSecondary/50" : "bg-morning-light-card/30";

	/* PHASE 13: CRITICAL FIXES */
	/* #1: Removed fixed height to allow Calendar and DatePanelContainer to expand naturally */
	/* #4: Shifted layout to the right with ml-[8%] and removed mx-auto */
	/* - Layout is right-shifted instead of centered */
	/* - Page scrolls to show full Diary section below Calendar */
	return (
		<div 
			className="flex flex-row gap-4 pb-40 mt-2 h-auto items-start ml-[8%] max-w-[92vw]"
		>
			{/* ═══ LEFT SPACER (Ratio 1) ═══ */}
			<div style={{ flex: "0.3 0 0" }} />

			{/* ═══ LEFT COLUMN (Ratio 1) - Sticky Sidebar ═══ */}
			{/* PHASE 19: Implemented sticky positioning for Left column */}
			{/* - sticky top-4: Sticks to top with small offset */}
			{/* - h-[calc(100vh-2rem)]: Takes full viewport height minus padding */}
			{/* - overflow-y-auto: Internal scroll for content exceeding viewport */}
			{/* - custom-scrollbar: Styled scrollbar for consistency */}
			<aside 
				className="sticky top-4 flex flex-col gap-4 flex-shrink-0 h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar"
				style={{ flex: "3 0 0", minWidth: "15%", maxWidth: "15%" }}
			>
				{/* BriefingWidget - Always visible (REQ-WS-002) */}
				<div className="flex-[1] min-h-0">
					<BriefingWidget />
				</div>
				{/* DiaryCard - Always visible (REQ-WS-002) */}
				<div className="flex-[1] min-h-0">
					<DiaryCard />
				</div>
			</aside>

			{/* ═══ MIDDLE COLUMN (Ratio 3) - Widget Scroll Box ═══ */}
			{/* PHASE 11: Removed max-h constraint, now stretches with items-stretch */}
			{/* - Middle column height now matches Calendar exactly */}
			{/* - Internal overflow-y-auto for widget scrolling */}
			<DragDropContext onDragEnd={handleMiddleDragEnd}>
				<Droppable droppableId="widgetScrollBox" direction="vertical">
					{(provided, snapshot) => (
						<main
							ref={provided.innerRef}
							{...provided.droppableProps}
							className={`
								widget-scroll-box
								flex-1 rounded-2xl transition-colors duration-200
								overflow-y-auto
								${scrollBoxBg}
								${snapshot.isDraggingOver ? (isDark ? "bg-blue-500/10" : "bg-blue-100/30") : ""}
							`}
							style={{ 
								flex: "3 0 0",
							}}
						>
							{/* Widget List - 1 widget per row (100% width, horizontal cards) */}
							<div className="flex flex-col gap-4 p-4">
								{middleWidgetOrder.map((widgetId, index) =>
									renderStandardWidget(widgetId, index)
								)}
								{provided.placeholder}
							</div>
						</main>
					)}
				</Droppable>
			</DragDropContext>

			{/* ═══ RIGHT COLUMN (Ratio 3) - Sticky Sidebar ═══ */}
			{/* PHASE 19: Implemented sticky positioning for Right column */}
			{/* - sticky top-4: Sticks to top with small offset */}
			{/* - h-[calc(100vh-2rem)]: Takes full viewport height minus padding */}
			{/* - overflow-y-auto: Internal scroll for content exceeding viewport */}
			{/* - custom-scrollbar: Styled scrollbar for consistency */}
			<aside 
				className="sticky top-4 flex flex-col gap-4 flex-shrink-0 h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar"
				style={{ flex: "3 0 0", minWidth: "25%", maxWidth: "25%" }}
			>
				{/* CalendarWidget - Top (REQ-WS-001) */}
				<div className="flex-[7] min-h-0 overflow-hidden">
					<CalendarWidget />
				</div>
			</aside>

			{/* ═══ RIGHT SPACER (Ratio 1) ═══ */}
			<div style={{ flex: "0.7 0 0" }} />
		</div>
	);
};

export default DashboardLayout;
