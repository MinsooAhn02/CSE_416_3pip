import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, RefreshCw, Settings, X, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import WidgetCard from "../common/WidgetCard";

const WIDGET_LIMIT = 6;

const STOCK_OPTIONS = [
	{ id: "KOSPI", label: "KOSPI" },
	{ id: "NASDAQ", label: "NASDAQ" },
	{ id: "SP500", label: "S&P 500" },
	{ id: "USDKRW", label: "USD/KRW" },
];

const StockCard = ({ s, isDark, secondaryBgCls }) => (
	<div className={`p-3 rounded-xl ${secondaryBgCls}`}>
		<div className="flex justify-between items-center mb-1">
			<span
				className={`text-[10px] ${isDark ? "text-gray-400" : "text-slate-500"}`}
			>
				{s.name}
			</span>
			<span
				className={`text-[10px] ${s.up ? "text-red-400" : "text-blue-400"}`}
			>
				{s.up ? "▲" : "▼"} {s.change}
			</span>
		</div>
		<p className="text-lg font-bold">{s.value}</p>
	</div>
);

const presetIds = new Set(STOCK_OPTIONS.map((o) => o.id));

const StocksWidget = () => {
	const { isDark, hoverCls, secondaryBgCls, borderCls } = useTheme();
	const { t } = useTranslation();
	const [showSettings, setShowSettings] = useState(false);
	const [showModal, setShowModal] = useState(false);
	const [customSymbol, setCustomSymbol] = useState("");
	const [validating, setValidating] = useState(false);
	const [validationError, setValidationError] = useState(null);
	const stocks = useDataStore((s) => s.stocks);
	const [orderedStocks, setOrderedStocks] = useState([]);
	const loading = useDataStore((s) => s.loading.stocks);
	const error = useDataStore((s) => s.errors.stocks);
	const apiStatus = useDataStore((s) => s.apiStatus.stocks ?? null);
	const fetchStocks = useDataStore((s) => s.fetchStocks);
	const validateStockSymbol = useDataStore((s) => s.validateStockSymbol);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const stockSymbols = useSettingsStore((s) => s.stockSymbols);
	const setStockSymbols = useSettingsStore((s) => s.setStockSymbols);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("stocks"));
	const selectedSet = useMemo(() => new Set(stockSymbols), [stockSymbols]);
	const customSymbols = useMemo(
		() => stockSymbols.filter((s) => !presetIds.has(s)),
		[stockSymbols],
	);

	const visibleStocks = orderedStocks.slice(0, WIDGET_LIMIT);
	const hasMore = orderedStocks.length > WIDGET_LIMIT;

	// Sync orderedStocks from store (preserves drag order until next fetch)
	useEffect(() => {
		setOrderedStocks(stocks);
	}, [stocks]);

	// Prevent body scroll when modal is open
	useEffect(() => {
		if (showModal) {
			const scrollbarWidth =
				window.innerWidth - document.documentElement.clientWidth;
			document.body.style.overflow = "hidden";
			document.body.style.paddingRight = `${scrollbarWidth}px`;
		}
		return () => {
			document.body.style.overflow = "";
			document.body.style.paddingRight = "";
		};
	}, [showModal]);

	const onDragEnd = (result) => {
		if (!result.destination || result.source.index === result.destination.index)
			return;
		const src = result.source.index;
		const dst = result.destination.index;
		const newStocks = Array.from(orderedStocks);
		const [moved] = newStocks.splice(src, 1);
		newStocks.splice(dst, 0, moved);
		setOrderedStocks(newStocks);
		const newSymbols = newStocks.map((s) => s.symbol).filter(Boolean);
		if (newSymbols.length > 0) setStockSymbols(newSymbols);
	};

	const toggleSymbol = async (symbol) => {
		const exists = selectedSet.has(symbol);
		let next = stockSymbols;
		if (exists) {
			next = stockSymbols.filter((s) => s !== symbol);
			if (next.length === 0) return;
		} else {
			next = [...stockSymbols, symbol];
		}
		setStockSymbols(next);
		await fetchStocks(next);
	};

	const removeSymbol = async (symbol) => {
		const next = stockSymbols.filter((s) => s !== symbol);
		if (next.length === 0) return;
		setStockSymbols(next);
		await fetchStocks(next, undefined, true);
	};

	const addCustomSymbol = async () => {
		const symbol = customSymbol.trim().toUpperCase();
		if (!symbol) return;
		if (selectedSet.has(symbol)) {
			setCustomSymbol("");
			setValidationError(null);
			return;
		}
		setValidating(true);
		setValidationError(null);
		const isValid = await validateStockSymbol(symbol);
		setValidating(false);
		if (!isValid) {
			setValidationError(t("widgets.stocks.invalid_ticker", { symbol }));
			return;
		}
		const next = [...stockSymbols, symbol];
		setStockSymbols(next);
		setCustomSymbol("");
		await fetchStocks(next);
	};

	return (
		<>
			<WidgetCard
				title={t("widgets.stocks.title")}
				icon={TrendingUp}
				widgetId="stocks"
				headerMeta={lastUpdatedText}
				onRefresh={() => fetchStocks(stockSymbols, undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
				apiStatus={apiStatus}
				apiError={error}
			>
				<div className="flex justify-end mb-2">
					<button
						onClick={() => setShowSettings((v) => !v)}
						className={`p-1 rounded-md ${hoverCls}`}
						title={t("widgets.stocks.symbol_settings")}
					>
						<Settings size={13} className="opacity-70" />
					</button>
				</div>

				{showSettings && (
					<div
						className={`mb-3 p-2 rounded-lg border ${borderCls} ${secondaryBgCls}`}
					>
						<p className="text-[11px] mb-2 opacity-70">
							{t("widgets.stocks.select_symbols")}
						</p>
						<div className="grid grid-cols-2 gap-2">
							{STOCK_OPTIONS.map((opt) => (
								<button
									key={opt.id}
									onClick={() => toggleSymbol(opt.id)}
									className={`text-xs px-2 py-1 rounded-md border ${
										selectedSet.has(opt.id)
											? "border-blue-400 text-blue-400"
											: isDark
												? "border-gray-600"
												: "border-gray-300"
									}`}
								>
									{opt.label}
								</button>
							))}
						</div>
						{customSymbols.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1">
								{customSymbols.map((sym) => (
									<span
										key={sym}
										className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-blue-400 text-blue-400"
									>
										{sym}
										<button
											onClick={() => void removeSymbol(sym)}
											className="hover:text-red-400 transition-colors"
											title={t("widgets.stocks.remove_symbol")}
										>
											<X size={10} />
										</button>
									</span>
								))}
							</div>
						)}
						<div className="mt-2 flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={customSymbol}
									onChange={(e) => {
										setCustomSymbol(e.target.value);
										setValidationError(null);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											void addCustomSymbol();
										}
									}}
									placeholder={t("widgets.stocks.custom_input")}
									className={`flex-grow text-xs rounded-md px-2 py-1.5 border outline-none ${
										validationError
											? "border-red-400"
											: isDark
												? "bg-white/5 border-white/20"
												: "bg-white border-gray-300"
									}`}
								/>
								<button
									onClick={() => void addCustomSymbol()}
									disabled={validating}
									className="text-xs px-2 py-1.5 rounded-md border border-blue-400 text-blue-400 disabled:opacity-50 whitespace-nowrap"
								>
									{validating ? "..." : t("common.add")}
								</button>
							</div>
							{validationError && (
								<p className="text-[10px] text-red-400">{validationError}</p>
							)}
						</div>
					</div>
				)}

				{loading ? (
					<p className="text-sm opacity-60">{t("widgets.stocks.loading")}</p>
				) : visibleStocks.length > 0 ? (
					<>
						<div className="grid grid-cols-2 gap-2">
							{visibleStocks.map((s, i) => (
								<StockCard
									key={i}
									s={s}
									isDark={isDark}
									secondaryBgCls={secondaryBgCls}
								/>
							))}
						</div>
						{hasMore && (
							<button
								onClick={() => setShowModal(true)}
								className={`mt-2 w-full text-xs py-1.5 rounded-lg ${hoverCls} opacity-70`}
							>
								{t("common.view_more", { count: stocks.length - WIDGET_LIMIT })}
							</button>
						)}
					</>
				) : error ? (
					<p className="text-[11px] text-red-400">{error}</p>
				) : (
					<p className="text-[11px] text-red-400">
						{t("widgets.stocks.no_data")}
					</p>
				)}
			</WidgetCard>

			{createPortal(
				<AnimatePresence>
					{showModal && (
						<>
							<motion.div
								className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-md"
								onClick={() => setShowModal(false)}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							/>
							<motion.div
								className={`fixed top-1/2 left-1/2 z-[10000] w-full max-w-2xl max-h-[80vh]
									rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
										isDark
											? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
											: "bg-morning-light-card border-morning-light-hover/30 text-morning-light-text"
									}`}
								style={{ x: "-50%", y: "-50%" }}
								initial={{ opacity: 0, scale: 0.5 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.5 }}
								transition={{ type: "spring", damping: 25, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div
									className={`flex items-center justify-between p-4 border-b ${
										isDark
											? "border-morning-dark-hover"
											: "border-morning-light-hover/30"
									}`}
								>
									<div className="flex items-center gap-3">
										<TrendingUp size={20} className="text-blue-500" />
										<h3 className="font-bold text-base">
											{t("widgets.stocks.title")}
										</h3>
									</div>
									<button
										onClick={() => setShowModal(false)}
										className={`p-2 rounded-full transition-colors ${
											isDark
												? "hover:bg-morning-dark-hover"
												: "hover:bg-morning-light-hover/30"
										}`}
									>
										<X size={18} />
									</button>
								</div>
								<div className="flex-1 overflow-y-auto p-4">
									<p className="text-[10px] mb-3 opacity-40 flex items-center gap-1">
										<GripVertical size={10} />
										{t("widgets.stocks.drag_to_reorder")}
									</p>
									<DragDropContext onDragEnd={onDragEnd}>
										<Droppable droppableId="stocks-modal-grid">
											{(provided) => (
												<div
													ref={provided.innerRef}
													{...provided.droppableProps}
													className="flex flex-wrap gap-2"
												>
													{orderedStocks.map((s, i) => (
														<Draggable
															key={s.symbol ?? s.name ?? i}
															draggableId={`stock-${s.symbol ?? s.name ?? i}`}
															index={i}
														>
															{(dragProvided, snapshot) => {
																const card = (
																	<div
																		ref={dragProvided.innerRef}
																		{...dragProvided.draggableProps}
																		{...dragProvided.dragHandleProps}
																		style={{
																			width: "calc(33.333% - 5.5px)",
																			...dragProvided.draggableProps.style,
																			...(snapshot.isDragging
																				? { zIndex: 10001 }
																				: {}),
																		}}
																		className={`relative p-3 rounded-xl cursor-grab active:cursor-grabbing select-none ${secondaryBgCls} ${snapshot.isDragging ? "shadow-xl ring-1 ring-blue-400/50 opacity-90" : ""}`}
																	>
																		<GripVertical
																			size={11}
																			className="absolute top-2 right-2 opacity-20 pointer-events-none"
																		/>
																		<div className="flex justify-between items-center mb-1 pr-3">
																			<span
																				className={`text-[10px] ${isDark ? "text-gray-400" : "text-slate-500"}`}
																			>
																				{s.name}
																			</span>
																			<span
																				className={`text-[10px] ${s.up ? "text-red-400" : "text-blue-400"}`}
																			>
																				{s.up ? "▲" : "▼"} {s.change}
																			</span>
																		</div>
																		<p className="text-lg font-bold">
																			{s.value}
																		</p>
																	</div>
																);
																// Portal the dragging item to document.body to escape
																// Framer Motion's CSS transform containing block, which
																// would otherwise misplace position:fixed coordinates.
																return snapshot.isDragging
																	? createPortal(card, document.body)
																	: card;
															}}
														</Draggable>
													))}
													{provided.placeholder}
												</div>
											)}
										</Droppable>
									</DragDropContext>
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body,
			)}
		</>
	);
};

export default StocksWidget;
