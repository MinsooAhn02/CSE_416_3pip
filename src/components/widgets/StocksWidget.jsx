import { useMemo, useState } from "react";
import { TrendingUp, RefreshCw, Settings } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import WidgetCard from "../common/WidgetCard";

const STOCK_OPTIONS = [
	{ id: "KOSPI", label: "KOSPI" },
	{ id: "NASDAQ", label: "NASDAQ" },
	{ id: "SP500", label: "S&P 500" },
	{ id: "USDKRW", label: "USD/KRW" },
];

const formatLastUpdated = (minutes) => {
	if (minutes == null) return "갱신 전";
	if (minutes <= 0) return "방금 갱신";
	return `${minutes}분 전`;
};

const StocksWidget = () => {
	const { isDark } = useTheme();
	const [showSettings, setShowSettings] = useState(false);
	const [customSymbol, setCustomSymbol] = useState("");
	const stocks = useDataStore((s) => s.stocks);
	const loading = useDataStore((s) => s.loading.stocks);
	const error = useDataStore((s) => s.errors.stocks);
	const rawStocks = useDataStore((s) => s.rawData.stocks);
	const fetchStocks = useDataStore((s) => s.fetchStocks);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const stockSymbols = useSettingsStore((s) => s.stockSymbols);
	const setStockSymbols = useSettingsStore((s) => s.setStockSymbols);

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("stocks"));
	const selectedSet = useMemo(() => new Set(stockSymbols), [stockSymbols]);

	const toggleSymbol = async (symbol) => {
		const exists = selectedSet.has(symbol);
		let next = stockSymbols;
		if (exists) {
			next = stockSymbols.filter((s) => s !== symbol);
			if (next.length === 0) return;
		} else {
			next = [...stockSymbols, symbol].slice(0, 4);
		}
		setStockSymbols(next);
		await fetchStocks(next);
	};

	const addCustomSymbol = async () => {
		const symbol = customSymbol.trim().toUpperCase();
		if (!symbol) return;
		if (selectedSet.has(symbol)) {
			setCustomSymbol("");
			return;
		}
		const next = [...stockSymbols, symbol].slice(0, 4);
		setStockSymbols(next);
		setCustomSymbol("");
		await fetchStocks(next);
	};

	return (
		<WidgetCard
			title="주식/환율"
			icon={TrendingUp}
			widgetId="stocks"
			headerMeta={lastUpdatedText}
			onRefresh={() => fetchStocks(stockSymbols, undefined, true)}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
		>
			<div className="flex justify-end mb-2">
				<button
					onClick={() => setShowSettings((v) => !v)}
					className={`p-1 rounded-md ${isDark ? "hover:bg-[#333333]" : "hover:bg-gray-100"}`}
					title="심볼 설정"
				>
					<Settings size={13} className="opacity-70" />
				</button>
			</div>

			{showSettings && (
				<div
					className={`mb-3 p-2 rounded-lg border ${
						isDark ? "border-[#3a3a3a] bg-[#333333]" : "border-gray-200 bg-gray-50"
					}`}
				>
					<p className="text-[11px] mb-2 opacity-70">
						표시 심볼 선택 (최대 4개)
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
					<div className="mt-2 flex items-center gap-2">
						<input
							type="text"
							value={customSymbol}
							onChange={(e) => setCustomSymbol(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									void addCustomSymbol();
								}
							}}
							placeholder="직접 입력 (예: AAPL)"
							className={`flex-grow text-xs rounded-md px-2 py-1.5 border outline-none ${
								isDark
									? "bg-white/5 border-white/20"
									: "bg-white border-gray-300"
							}`}
						/>
						<button
							onClick={() => void addCustomSymbol()}
							className="text-xs px-2 py-1.5 rounded-md border border-blue-400 text-blue-400"
						>
							추가
						</button>
					</div>
				</div>
			)}

			{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
			{loading ? (
				<p className="text-sm opacity-60">주식/환율 데이터를 불러오는 중...</p>
			) : stocks.length === 0 ? (
				<p className="text-sm opacity-60">
					표시할 주식/환율 데이터가 없습니다.
				</p>
			) : (
				<div className="grid grid-cols-2 gap-2">
					{stocks.map((s, i) => (
						<div
							key={i}
							className={`p-3 rounded-xl ${isDark ? "bg-[#333333]" : "bg-gray-50"}`}
						>
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
					))}
				</div>
			)}

			<details className="mt-3">
				<summary className="text-[11px] opacity-70 cursor-pointer">
					원본 API 데이터 (stocks)
				</summary>
				<pre
					className={`mt-2 text-[10px] leading-relaxed p-2 rounded-lg overflow-auto max-h-48 ${
						isDark ? "bg-[#222222]" : "bg-gray-100"
					}`}
				>
					{JSON.stringify(rawStocks ?? stocks, null, 2)}
				</pre>
			</details>
		</WidgetCard>
	);
};

export default StocksWidget;
