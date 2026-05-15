import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, RefreshCw, Settings, X, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useFontSize } from "../../hooks/useFontSize";
import { useSettingsStore } from "../../store/useSettingsStore";
import WidgetCard from "../common/WidgetCard";

const WIDGET_LIMIT = 6;
const MODAL_GRID_COLUMNS = 4;
const SYMBOL_ALIAS_MAP = {
	KOSPI: "KOSPI",
	KS11: "KOSPI",
	"^KOSPI": "KOSPI",
	"^KS11": "KOSPI",
	NASDAQ: "NASDAQ",
	IXIC: "NASDAQ",
	"^IXIC": "NASDAQ",
	SP500: "SP500",
	"SP 500": "SP500",
	"S&P500": "SP500",
	"S&P 500": "SP500",
	SPX: "SP500",
	"^SPX": "SP500",
	USDKRW: "USDKRW",
	"USD/KRW": "USDKRW",
	"USD-KRW": "USDKRW",
};

const normalizeWidgetSymbol = (value) => {
	const upper = String(value ?? "")
		.trim()
		.toUpperCase();
	if (!upper) return "";
	return SYMBOL_ALIAS_MAP[upper] ?? upper;
};

const normalizeWidgetSymbols = (symbols) =>
	Array.from(
		new Set(
			(Array.isArray(symbols) ? symbols : [])
				.map(normalizeWidgetSymbol)
				.filter(Boolean),
		),
	);

const getStockKey = (stock) =>
	normalizeWidgetSymbol(stock?.symbol ?? stock?.name ?? "");

const getStockNumericValue = (stock) => {
	const raw = stock?.value ?? stock?.price;
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
	if (typeof raw !== "string") return 0;
	const parsed = Number(raw.replace(/[^0-9.\-]/g, ""));
	return Number.isFinite(parsed) ? parsed : 0;
};

const STOCK_OPTIONS = [
	{ id: "KOSPI", label: "KOSPI" },
	{ id: "NASDAQ", label: "NASDAQ" },
	{ id: "SP500", label: "S&P 500" },
	{ id: "USDKRW", label: "USD/KRW" },
];

const StockCard = ({ s, isDark, secondaryBgCls, bodyStyle }) => (
	<div className={`p-3 rounded-xl ${secondaryBgCls}`}>
		<div className="flex justify-between items-center mb-1">
			<span
				className={isDark ? "text-gray-400" : "text-slate-500"}
				style={bodyStyle}
			>
				{s.name}
			</span>
			<span
				className={s.up ? "text-red-400" : "text-blue-400"}
				style={bodyStyle}
			>
				{s.up ? "▲" : "▼"} {s.change}
			</span>
		</div>
		<p className="text-lg font-bold">{s.value}</p>
	</div>
);

const CURRENCY_MAP = {
	KOSPI: "KRW",
	NASDAQ: "USD",
	SP500: "USD",
	USDKRW: "Rate",
};
const getCurrency = (s) =>
	CURRENCY_MAP[s.symbol] ?? (String(s.name ?? "").includes("KRW") ? "KRW" : "USD");

const presetIds = new Set(STOCK_OPTIONS.map((o) => o.id));

const StocksWidget = () => {
	const { isDark, hoverCls, secondaryBgCls, borderCls } = useTheme();
	const { body: bodyStyle } = useFontSize();
	const { t } = useTranslation();
	const [showSettings, setShowSettings] = useState(false);
	const [showModal, setShowModal] = useState(false);
	const [showViewAll, setShowViewAll] = useState(false);
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
	const normalizedStockSymbols = useMemo(
		() => normalizeWidgetSymbols(stockSymbols),
		[stockSymbols],
	);
	const selectedSet = useMemo(
		() => new Set(normalizedStockSymbols),
		[normalizedStockSymbols],
	);
	const customSymbols = useMemo(
		() => normalizedStockSymbols.filter((s) => !presetIds.has(s)),
		[normalizedStockSymbols],
	);

	const visibleStocks = orderedStocks.slice(0, WIDGET_LIMIT);
	const totalStockCount = Math.max(
		orderedStocks.length,
		normalizedStockSymbols.length,
	);
	const hasMore = totalStockCount > WIDGET_LIMIT;
	const modalStockRows = useMemo(() => {
		const rows = [];
		for (let i = 0; i < orderedStocks.length; i += MODAL_GRID_COLUMNS) {
			rows.push(orderedStocks.slice(i, i + MODAL_GRID_COLUMNS));
		}
		return rows;
	}, [orderedStocks]);

	// Sync orderedStocks from store (preserves drag order until next fetch)
	useEffect(() => {
		setOrderedStocks((prev) => {
			const prevByKey = new Map(
				(prev || [])
					.map((item) => [getStockKey(item), item])
					.filter(([key]) => Boolean(key)),
			);
			return (stocks || []).map((item) => {
				const key = getStockKey(item);
				const prevItem = prevByKey.get(key);
				if (!prevItem) return item;
				return getStockNumericValue(item) > 0 ? item : prevItem;
			});
		});
	}, [stocks]);

	useEffect(() => {
		if (normalizedStockSymbols.length === 0) return;
		const isSameOrderAndValue =
			normalizedStockSymbols.length === stockSymbols.length &&
			normalizedStockSymbols.every((s, i) => s === stockSymbols[i]);
		if (isSameOrderAndValue) return;
		setStockSymbols(normalizedStockSymbols);
		void fetchStocks(normalizedStockSymbols, undefined, true);
	}, [normalizedStockSymbols, stockSymbols, setStockSymbols, fetchStocks]);

	// Prevent body scroll when any modal is open
	useEffect(() => {
		if (showModal || showViewAll) {
			const scrollbarWidth =
				window.innerWidth - document.documentElement.clientWidth;
			document.body.style.overflow = "hidden";
			document.body.style.paddingRight = `${scrollbarWidth}px`;
		}
		return () => {
			document.body.style.overflow = "";
			document.body.style.paddingRight = "";
		};
	}, [showModal, showViewAll]);

	const onDragEnd = (result) => {
		if (!result.destination) return;
		const parseRowIndex = (droppableId) => {
			const prefix = "stocks-modal-row-";
			if (!droppableId.startsWith(prefix)) return 0;
			const value = Number(droppableId.slice(prefix.length));
			return Number.isFinite(value) ? value : 0;
		};
		const src =
			parseRowIndex(result.source.droppableId) * MODAL_GRID_COLUMNS +
			result.source.index;
		const dst =
			parseRowIndex(result.destination.droppableId) * MODAL_GRID_COLUMNS +
			result.destination.index;
		if (src === dst) return;
		const newStocks = Array.from(orderedStocks);
		const [moved] = newStocks.splice(src, 1);
		newStocks.splice(dst, 0, moved);
		setOrderedStocks(newStocks);
		const newSymbols = normalizeWidgetSymbols(
			newStocks.map((s) => s?.symbol ?? s?.name),
		);
		if (newSymbols.length > 0) setStockSymbols(newSymbols);
	};

	const toggleSymbol = async (symbol) => {
		const normalized = normalizeWidgetSymbol(symbol);
		const exists = selectedSet.has(normalized);
		let next = normalizedStockSymbols;
		if (exists) {
			next = normalizedStockSymbols.filter((s) => s !== normalized);
			if (next.length === 0) return;
		} else {
			next = [...normalizedStockSymbols, normalized];
		}
		setStockSymbols(next);
		await fetchStocks(next);
	};

	const removeSymbol = async (symbol) => {
		const normalized = normalizeWidgetSymbol(symbol);
		const next = normalizedStockSymbols.filter((s) => s !== normalized);
		if (next.length === 0) return;
		setStockSymbols(next);
		await fetchStocks(next, undefined, true);
	};

	const addCustomSymbol = async () => {
		const symbol = normalizeWidgetSymbol(customSymbol);
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
		const next = [...normalizedStockSymbols, symbol];
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
				onRefresh={() => fetchStocks(normalizedStockSymbols, undefined, true)}
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
						<button
							onClick={() => { setShowSettings(false); setShowModal(true); }}
							className={`mt-2 w-full text-[11px] py-1.5 rounded-lg ${hoverCls} opacity-60 border ${borderCls}`}
						>
							{t("widgets.stocks.manage_order")}
						</button>
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
									bodyStyle={bodyStyle}
								/>
							))}
						</div>
						{hasMore && (
							<button
								onClick={() => setShowViewAll(true)}
								className={`mt-2 w-full text-xs py-1.5 rounded-lg ${hoverCls} opacity-70`}
							>
								{t("common.view_more", {
									count: Math.max(totalStockCount - WIDGET_LIMIT, 0),
								})}
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
								className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							>
								<div
									className={`w-full max-w-5xl max-h-[80vh]
										rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
											isDark
												? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
												: "bg-morning-light-card border-morning-light-hover/30 text-morning-light-text"
										}`}
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
											<div className="overflow-auto pb-1">
												<div className="space-y-2 min-w-[900px]">
												{modalStockRows.map((row, rowIndex) => (
													<Droppable
														key={`stocks-modal-row-${rowIndex}`}
														droppableId={`stocks-modal-row-${rowIndex}`}
														direction="horizontal"
														type="stocks-modal-grid"
													>
														{(provided, dropSnapshot) => (
															<div
																ref={provided.innerRef}
																{...provided.droppableProps}
																className={`grid grid-cols-4 gap-2 rounded-xl ${
																	dropSnapshot.isDraggingOver
																		? "bg-blue-500/5"
																		: ""
																}`}
															>
																{row.map((s, colIndex) => {
																	const globalIndex =
																		rowIndex * MODAL_GRID_COLUMNS + colIndex;
																	const stableId = s.symbol ?? s.name ?? globalIndex;
																	return (
																		<Draggable
																			key={stableId}
																			draggableId={`stock-${stableId}`}
																			index={colIndex}
																		>
																			{(dragProvided, snapshot) => (
																				<div
																					ref={dragProvided.innerRef}
																					{...dragProvided.draggableProps}
																					{...dragProvided.dragHandleProps}
																					style={{
																						...dragProvided.draggableProps.style,
																						...(snapshot.isDropAnimating
																							? {
																									transitionDuration: "0.001s",
																									transitionTimingFunction: "linear",
																								}
																							: {}),
																						...(snapshot.isDragging
																							? { zIndex: 10001 }
																							: {}),
																					}}
																					className={`relative p-3 rounded-xl cursor-grab active:cursor-grabbing select-none min-h-[74px] ${secondaryBgCls} ${
																						snapshot.isDragging
																							? "shadow-xl ring-1 ring-blue-400/50"
																							: ""
																					}`}
																				>
																					<GripVertical
																						size={11}
																						className="absolute top-2 right-2 opacity-20 pointer-events-none"
																					/>
																					<div className="flex justify-between items-center mb-1 pr-3">
																						<span
																							className={`text-[10px] truncate ${isDark ? "text-gray-400" : "text-slate-500"}`}
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
																			)}
																		</Draggable>
																	);
																})}
																{provided.placeholder}
															</div>
														)}
													</Droppable>
												))}
												</div>
											</div>
										</DragDropContext>
									</div>
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body,
			)}

			{createPortal(
				<AnimatePresence>
					{showViewAll && (
						<>
							<motion.div
								className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-md"
								onClick={() => setShowViewAll(false)}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							/>
							<motion.div
								className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							>
								<div
									className={`w-full max-w-2xl max-h-[85vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
										isDark
											? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
											: "bg-morning-light-card border-morning-light-hover/30 text-morning-light-text"
									}`}
									onClick={(e) => e.stopPropagation()}
								>
									<div
										className={`flex-shrink-0 flex items-center justify-between p-4 border-b ${
											isDark ? "border-morning-dark-hover" : "border-morning-light-hover/30"
										}`}
									>
										<div className="flex items-center gap-3">
											<TrendingUp size={18} className="text-blue-500" />
											<h3 className="font-bold text-base">{t("widgets.stocks.title")}</h3>
										</div>
										<button
											onClick={() => setShowViewAll(false)}
											className={`p-2 rounded-full transition-colors ${
												isDark ? "hover:bg-morning-dark-hover" : "hover:bg-morning-light-hover/30"
											}`}
										>
											<X size={18} />
										</button>
									</div>
									<div className="flex-1 overflow-y-auto p-4">
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
											{orderedStocks.map((s, i) => (
												<div key={i} className={`p-3 rounded-xl ${secondaryBgCls}`}>
													<div className="flex justify-between items-center mb-1">
														<span
															className={isDark ? "text-gray-400" : "text-slate-500"}
															style={bodyStyle}
														>
															{s.name}
														</span>
														<span
															className={s.up ? "text-red-400" : "text-blue-400"}
															style={bodyStyle}
														>
															{s.up ? "▲" : "▼"} {s.change}
														</span>
													</div>
													<p className="text-lg font-bold">{s.value}</p>
													<p className="opacity-40" style={bodyStyle}>{getCurrency(s)}</p>
												</div>
											))}
										</div>
									</div>
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
