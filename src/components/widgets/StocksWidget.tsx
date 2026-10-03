import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, RefreshCw, X, GripVertical, Plus } from "lucide-react";
import ConfirmDialog from "../common/ConfirmDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useFontSize } from "../../hooks/useFontSize";
import { useSettingsStore } from "../../store/useSettingsStore";
import WidgetCard from "../common/WidgetCard";
import type { StockItem } from "../../types/index";

interface StockCardProps {
	s: StockItem & { type?: string; currency?: string; up?: boolean };
	isDark: boolean;
	secondaryBgCls: string;
	bodyStyle: React.CSSProperties;
}

interface PlaceholderCardProps {
	secondaryBgCls: string;
}

const MODAL_GRID_COLUMNS = 4;
const WIDGET_FIXED_VISIBLE = 2;
const WIDGET_USER_VISIBLE = 4;

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
	VIX: "VIX",
	"^VIX": "VIX",
	CRUDE: "CRUDE",
	USOIL: "CRUDE",
	WTI: "CRUDE",
	DXY: "DXY",
	"^DXY": "DXY",
	"DX-Y.NYB": "DXY",
	"DX=F": "DXY",
	DJI: "DJI",
	"^DJI": "DJI",
	DJIA: "DJI",
};

const normalizeWidgetSymbol = (value: string): string => {
	const upper = String(value ?? "")
		.trim()
		.toUpperCase();
	if (!upper) return "";
	return (SYMBOL_ALIAS_MAP as Record<string, string>)[upper] ?? upper;
};

const normalizeWidgetSymbols = (symbols: string[]): string[] =>
	Array.from(
		new Set(
			(Array.isArray(symbols) ? symbols : [])
				.map(normalizeWidgetSymbol)
				.filter(Boolean),
		),
	);

const getStockKey = (stock: StockItem & { type?: string; currency?: string; up?: boolean }): string =>
	normalizeWidgetSymbol(stock?.symbol ?? stock?.name ?? "");

const CURRENCY_SYMBOL = { USD: "$", KRW: "₩", JPY: "¥", EUR: "€", GBP: "£", CNY: "¥", HKD: "HK$" };
const LEGACY_INDEX_SYMBOLS = new Set(["KOSPI", "NASDAQ", "SP500", "VIX", "DXY", "DJI"]);
const LEGACY_RATE_SYMBOLS = new Set(["USDKRW"]);

const getCurrency = (s: StockItem & { type?: string; currency?: string }): string => {
	if (s?.type === "index") return "Index";
	if (s?.type === "currency") return "Rate";
	if (s?.currency && (CURRENCY_SYMBOL as Record<string, string>)[s.currency]) return s.currency;
	const sym = String(s?.symbol ?? "").toUpperCase();
	if (LEGACY_INDEX_SYMBOLS.has(sym)) return "Index";
	if (LEGACY_RATE_SYMBOLS.has(sym)) return "Rate";
	if (String(s?.name ?? "").includes("KRW")) return "KRW";
	return "USD";
};

const StockCard = ({ s, isDark, secondaryBgCls, bodyStyle }: StockCardProps) => {
	const cur = getCurrency(s);
	const curSymbol = (CURRENCY_SYMBOL as Record<string, string>)[cur] ?? "";
	return (
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
			<p className="text-lg font-bold">
				{curSymbol && (
					<span className="text-xs font-normal opacity-50 mr-0.5">{curSymbol}</span>
				)}
				{s.value}
			</p>
		</div>
	);
};

const PlaceholderCard = ({ secondaryBgCls }: PlaceholderCardProps) => (
	<div className={`p-3 rounded-xl ${secondaryBgCls} animate-pulse`}>
		<div className="h-3 rounded bg-white/10 mb-2 w-2/3"></div>
		<div className="h-6 rounded bg-white/10 w-1/2"></div>
	</div>
);

const StocksWidget = () => {
	const { isDark, hoverCls, secondaryBgCls } = useTheme();
	const { body: bodyStyle } = useFontSize();
	const { t } = useTranslation();
	const [showModal, setShowModal] = useState(false);
	const [customSymbol, setCustomSymbol] = useState("");
	const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; symbol: string | null }>({ open: false, symbol: null });
	const [validating, setValidating] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);
	// Consolidated data-field selector — one subscription, shallow equality
	const { stocks, loading, error, apiStatus } = useDataStore(useShallow((s) => ({
		stocks: s.stocks,
		loading: s.loading.stocks,
		error: s.errors.stocks,
		apiStatus: s.apiStatus.stocks ?? null,
	})));
	// Actions are stable Zustand references — separate subscriptions cause no extra renders
	const fetchStocks = useDataStore((s) => s.fetchStocks);
	const validateStockSymbol = useDataStore((s) => s.validateStockSymbol);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const stockSymbols = useSettingsStore((s) => s.stockSymbols);
	const setStockSymbols = useSettingsStore((s) => s.setStockSymbols);
	const fixedIndexSymbols = useSettingsStore((s) => s.fixedIndexSymbols);
	const setFixedIndexSymbols = useSettingsStore((s) => s.setFixedIndexSymbols);

	const formatLastUpdated = (minutes: number | null | undefined): string => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("stocks"));

	const normalizedStockSymbols = useMemo(
		() => normalizeWidgetSymbols(stockSymbols),
		[stockSymbols],
	);

	const allSymbols = useMemo(
		() => [...new Set([...fixedIndexSymbols, ...normalizedStockSymbols])],
		[fixedIndexSymbols, normalizedStockSymbols],
	);

	const stocksBySymbol = useMemo(() => {
		const map = new Map();
		(stocks || []).forEach((item) => {
			const key = getStockKey(item);
			if (key) map.set(key, item);
		});
		return map;
	}, [stocks]);

	const orderedFixedIndices = useMemo(
		() =>
			fixedIndexSymbols
				.map((sym) => stocksBySymbol.get(normalizeWidgetSymbol(sym)) ?? null)
				.filter(Boolean),
		[fixedIndexSymbols, stocksBySymbol],
	);

	const orderedUserStocks = useMemo(
		() =>
			normalizedStockSymbols
				.map((sym) => stocksBySymbol.get(sym) ?? null)
				.filter(Boolean),
		[normalizedStockSymbols, stocksBySymbol],
	);

	const fixedIndexRows = useMemo(() => {
		const rows = [];
		for (let i = 0; i < orderedFixedIndices.length; i += MODAL_GRID_COLUMNS) {
			rows.push(orderedFixedIndices.slice(i, i + MODAL_GRID_COLUMNS));
		}
		return rows;
	}, [orderedFixedIndices]);

	const userStockRows = useMemo(() => {
		const rows = [];
		for (let i = 0; i < orderedUserStocks.length; i += MODAL_GRID_COLUMNS) {
			rows.push(orderedUserStocks.slice(i, i + MODAL_GRID_COLUMNS));
		}
		return rows;
	}, [orderedUserStocks]);

	const selectedSet = useMemo(
		() => new Set(normalizedStockSymbols),
		[normalizedStockSymbols],
	);

	const fixedSet = useMemo(
		() => new Set(fixedIndexSymbols.map((s) => normalizeWidgetSymbol(s))),
		[fixedIndexSymbols],
	);

	const didInitialFetch = useRef(false);
	useEffect(() => {
		if (didInitialFetch.current || allSymbols.length === 0) return;
		didInitialFetch.current = true;
		void fetchStocks(allSymbols, undefined, false);
	}, [allSymbols, fetchStocks]);

	const prevUserSymbols = useRef(normalizedStockSymbols);
	useEffect(() => {
		if (prevUserSymbols.current === normalizedStockSymbols) return;
		prevUserSymbols.current = normalizedStockSymbols;
		void fetchStocks(allSymbols, undefined, true);
	}, [normalizedStockSymbols, allSymbols, fetchStocks]);

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

	const onFixedDragEnd = (result: { destination?: { droppableId: string; index: number } | null; source: { droppableId: string; index: number } }) => {
		if (!result.destination) return;
		const parseRowIndex = (id: string): number => {
			const prefix = "stocks-fixed-row-";
			if (!id.startsWith(prefix)) return 0;
			const v = Number(id.slice(prefix.length));
			return Number.isFinite(v) ? v : 0;
		};
		const src = parseRowIndex(result.source.droppableId) * MODAL_GRID_COLUMNS + result.source.index;
		const dst = parseRowIndex(result.destination.droppableId) * MODAL_GRID_COLUMNS + result.destination.index;
		if (src === dst) return;
		const next = Array.from(fixedIndexSymbols);
		const [moved] = next.splice(src, 1);
		next.splice(dst, 0, moved);
		setFixedIndexSymbols(next);
	};

	const onUserDragEnd = (result: { destination?: { droppableId: string; index: number } | null; source: { droppableId: string; index: number } }) => {
		if (!result.destination) return;
		const parseRowIndex = (id: string): number => {
			const prefix = "stocks-user-row-";
			if (!id.startsWith(prefix)) return 0;
			const v = Number(id.slice(prefix.length));
			return Number.isFinite(v) ? v : 0;
		};
		const src = parseRowIndex(result.source.droppableId) * MODAL_GRID_COLUMNS + result.source.index;
		const dst = parseRowIndex(result.destination.droppableId) * MODAL_GRID_COLUMNS + result.destination.index;
		if (src === dst) return;
		const next = Array.from(normalizedStockSymbols);
		const [moved] = next.splice(src, 1);
		next.splice(dst, 0, moved);
		setStockSymbols(next);
	};

	const removeSymbol = async (symbol: string) => {
		const normalized = normalizeWidgetSymbol(symbol);
		const next = normalizedStockSymbols.filter((s) => s !== normalized);
		setStockSymbols(next);
		if (next.length > 0) await fetchStocks([...fixedIndexSymbols, ...next], undefined, true);
	};

	const handleConfirmDelete = async () => {
		const symbol = confirmDelete.symbol;
		setConfirmDelete({ open: false, symbol: null });
		if (!symbol) return;
		try {
			await removeSymbol(symbol);
		} catch (err) {
			console.warn("Failed to remove stock:", err);
		}
	};

	const addCustomSymbol = async () => {
		const symbol = normalizeWidgetSymbol(customSymbol);
		if (!symbol) return;
		if (fixedSet.has(symbol)) {
			setCustomSymbol("");
			setValidationError(null);
			return;
		}
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
		await fetchStocks([...fixedIndexSymbols, ...next], undefined, true);
	};

	const visibleFixed = orderedFixedIndices.slice(0, WIDGET_FIXED_VISIBLE);
	// 기본 stockSymbols에 지수(KOSPI/SP500)가 포함돼 상단 고정 슬롯과 중복 표시되는 것 방지
	const shownFixedKeys = new Set(visibleFixed.map(getStockKey));
	const widgetUserStocks = orderedUserStocks.filter((s) => !shownFixedKeys.has(getStockKey(s)));
	const visibleUser = widgetUserStocks.slice(0, WIDGET_USER_VISIBLE);
	const hasMoreUser = widgetUserStocks.length > WIDGET_USER_VISIBLE;

	return (
		<>
			<WidgetCard
				title={t("widgets.stocks.title")}
				icon={TrendingUp}
				widgetId="stocks"
				headerMeta={lastUpdatedText}
				onRefresh={() => fetchStocks(allSymbols, undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
				apiStatus={apiStatus}
				apiError={error}
			>
				<div className="flex justify-end mb-2">
					<button
						onClick={() => setShowModal(true)}
						className={`p-1 rounded-md ${hoverCls}`}
						title={t("common.add")}
					>
						<Plus size={13} className="opacity-70" />
					</button>
				</div>

				{loading && orderedFixedIndices.length === 0 ? (
					<p className="text-sm opacity-60">{t("widgets.stocks.loading")}</p>
				) : (
					<>
						{/* Top 2 fixed index slots */}
						<div className="grid grid-cols-2 gap-2">
							{Array.from({ length: WIDGET_FIXED_VISIBLE }).map((_, i) =>
								visibleFixed[i] ? (
									<StockCard
										key={visibleFixed[i].symbol ?? i}
										s={visibleFixed[i]}
										isDark={isDark}
										secondaryBgCls={secondaryBgCls}
										bodyStyle={bodyStyle}
									/>
								) : (
									<PlaceholderCard key={`ph-${i}`} secondaryBgCls={secondaryBgCls} />
								),
							)}
						</div>
						{/* Separator between fixed indices and user stocks */}
						<hr className={`my-2 ${isDark ? "border-white/10" : "border-black/10"}`} />
						{/* User stock slots */}
						<div className="grid grid-cols-2 gap-2">
							{visibleUser.map((s, i) => (
								<StockCard
									key={s.symbol ?? i}
									s={s}
									isDark={isDark}
									secondaryBgCls={secondaryBgCls}
									bodyStyle={bodyStyle}
								/>
							))}
						</div>
						{hasMoreUser && (
							<button
								onClick={() => setShowModal(true)}
								className={`mt-2 w-full text-xs py-1.5 rounded-lg ${hoverCls} opacity-70`}
							>
								{t("common.view_more", {
									count: widgetUserStocks.length - WIDGET_USER_VISIBLE,
								})}
							</button>
						)}
					</>
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
									{/* Modal header */}
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
										{/* Fixed indices section */}
										<div className="mb-1">
											<p className="text-[11px] font-semibold opacity-60 uppercase tracking-wider mb-1">
												Major Indices
											</p>
											<p className="text-[10px] mb-3 opacity-40 flex items-center gap-1">
												<GripVertical size={10} />
												{t("widgets.stocks.drag_to_reorder")}
											</p>
											<DragDropContext onDragEnd={onFixedDragEnd}>
												<div className="overflow-auto pb-1">
													<div className="space-y-2 min-w-[900px]">
														{fixedIndexRows.map((row, rowIndex) => (
															<Droppable
																key={`stocks-fixed-row-${rowIndex}`}
																droppableId={`stocks-fixed-row-${rowIndex}`}
																direction="horizontal"
																type="stocks-fixed-grid"
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
																			const stableId = s?.symbol ?? colIndex;
																			return (
																				<Draggable
																					key={stableId}
																					draggableId={`fixed-${stableId}`}
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
																								className="absolute bottom-2 right-2 opacity-20 pointer-events-none"
																							/>
																							<div className="flex justify-between items-center mb-1">
																								<span
																									className={`text-[10px] truncate ${isDark ? "text-gray-400" : "text-slate-500"}`}
																								>
																									{s?.name}
																								</span>
																								<span
																									className={`text-[10px] ${s?.up ? "text-red-400" : "text-blue-400"}`}
																								>
																									{s?.up ? "▲" : "▼"} {s?.change}
																								</span>
																							</div>
																							<p className="text-lg font-bold">
																								{(() => {
																									const sym = (CURRENCY_SYMBOL as Record<string, string>)[getCurrency(s)] ?? "";
																									return sym ? (
																										<><span className="text-[9px] font-normal opacity-50 mr-0.5">{sym}</span>{s?.value}</>
																									) : s?.value;
																								})()}
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

										{/* Separator */}
										<hr
											className={`my-4 ${
												isDark
													? "border-morning-dark-hover"
													: "border-morning-light-hover/30"
											}`}
										/>

										{/* User stocks section */}
										<div>
											<p className="text-[11px] font-semibold opacity-60 uppercase tracking-wider mb-1">
												My Stocks
											</p>
											{/* Ticker input */}
											<div className="flex-shrink-0 py-2 mb-3">
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
														className="text-xs px-3 py-1.5 rounded-md border border-blue-400 text-blue-400 disabled:opacity-50 whitespace-nowrap"
													>
														{validating ? "..." : t("common.add")}
													</button>
												</div>
												{validationError && (
													<p className="text-[10px] text-red-400 mt-1">{validationError}</p>
												)}
											</div>

											{orderedUserStocks.length === 0 ? (
												<p className="text-[11px] opacity-40 text-center py-4">
													{t("widgets.stocks.no_data")}
												</p>
											) : (
												<>
													<p className="text-[10px] mb-3 opacity-40 flex items-center gap-1">
														<GripVertical size={10} />
														{t("widgets.stocks.drag_to_reorder")}
													</p>
													<DragDropContext onDragEnd={onUserDragEnd}>
														<div className="overflow-auto pb-1">
															<div className="space-y-2 min-w-[900px]">
																{userStockRows.map((row, rowIndex) => (
																	<Droppable
																		key={`stocks-user-row-${rowIndex}`}
																		droppableId={`stocks-user-row-${rowIndex}`}
																		direction="horizontal"
																		type="stocks-user-grid"
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
																					const stableId = s?.symbol ?? s?.name ?? colIndex;
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
																									{/* X delete button */}
																									<button
																										onMouseDown={(e) => e.stopPropagation()}
																										onPointerDown={(e) => e.stopPropagation()}
																										onClick={(e) => {
																											e.stopPropagation();
																											setConfirmDelete({ open: true, symbol: s?.symbol ?? s?.name });
																										}}
																										className={`absolute top-1.5 right-1.5 p-0.5 rounded-full opacity-30 hover:opacity-100 transition-opacity ${isDark ? "hover:bg-red-500/20" : "hover:bg-red-500/10"}`}
																									>
																										<X size={11} />
																									</button>
																									<GripVertical
																										size={11}
																										className="absolute bottom-2 right-2 opacity-20 pointer-events-none"
																									/>
																									<div className="flex justify-between items-center mb-1 pr-3">
																										<span
																											className={`text-[10px] truncate ${isDark ? "text-gray-400" : "text-slate-500"}`}
																										>
																											{s?.name}
																										</span>
																										<span
																											className={`text-[10px] ${s?.up ? "text-red-400" : "text-blue-400"}`}
																										>
																											{s?.up ? "▲" : "▼"} {s?.change}
																										</span>
																									</div>
																									<p className="text-lg font-bold">
																										{(() => {
																											const sym = (CURRENCY_SYMBOL as Record<string, string>)[getCurrency(s)] ?? "";
																											return sym ? (
																												<><span className="text-[9px] font-normal opacity-50 mr-0.5">{sym}</span>{s?.value}</>
																											) : s?.value;
																										})()}
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
												</>
											)}
										</div>
									</div>
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body,
			)}

			{confirmDelete.open && (
				<ConfirmDialog
					title={t("widgets.stocks.confirm_delete_title")}
					message={t("widgets.stocks.confirm_delete_message", { symbol: confirmDelete.symbol })}
					onConfirm={handleConfirmDelete}
					onCancel={() => setConfirmDelete({ open: false, symbol: null })}
				/>
			)}
		</>
	);
};

export default memo(StocksWidget);
