import { TrendingUp } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const StocksWidget = () => {
	const { isDark } = useTheme();
	const stocks = useDataStore((s) => s.stocks);
	const loading = useDataStore((s) => s.loading.stocks);
	const error = useDataStore((s) => s.errors.stocks);
	const rawStocks = useDataStore((s) => s.rawData.stocks);

	return (
		<WidgetCard title="주식/환율" icon={TrendingUp} widgetId="stocks">
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
							className={`p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
						>
							<div className="flex justify-between items-center mb-1">
								<span
									className={`text-[10px] ${isDark ? "opacity-60" : "text-slate-500"}`}
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
						isDark ? "bg-black/20" : "bg-gray-100"
					}`}
				>
					{JSON.stringify(rawStocks ?? stocks, null, 2)}
				</pre>
			</details>
		</WidgetCard>
	);
};

export default StocksWidget;
