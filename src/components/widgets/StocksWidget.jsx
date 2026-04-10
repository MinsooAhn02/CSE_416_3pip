import { useMemo, useState } from "react";
import { TrendingUp, RefreshCw, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
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

const StocksWidget = () => {
	const { isDark, hoverCls, secondaryBgCls, borderCls } = useTheme();
	const { t } = useTranslation();
	const [showSettings, setShowSettings] = useState(false);
	const [customSymbol, setCustomSymbol] = useState("");
	const stocks = useDataStore((s) => s.stocks);
	const loading = useDataStore((s) => s.loading.stocks);
	const error = useDataStore((s) => s.errors.stocks);
	const apiStatus = useDataStore((s) => s.apiStatus.stocks ?? null);
	const fetchStocks = useDataStore((s) => s.fetchStocks);
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
					className={`mb-3 p-2 rounded-lg border ${
						`${borderCls} ${secondaryBgCls}`
					}`}
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
							placeholder={t("widgets.stocks.custom_input")}
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
							{t("common.add")}
						</button>
					</div>
				</div>
			)}

			{loading ? (
				<p className="text-sm opacity-60">{t("widgets.stocks.loading")}</p>
			) : stocks.length > 0 ? (
				<div className="grid grid-cols-2 gap-2">
					{stocks.map((s, i) => (
						<div
							key={i}
							className={`p-3 rounded-xl ${secondaryBgCls}`}
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
			) : error ? (
				<p className="text-[11px] text-red-400">{error}</p>
			) : (
				<p className="text-[11px] text-red-400">{t("widgets.stocks.no_data")}</p>
			)}
		</WidgetCard>
	);
};

export default StocksWidget;
