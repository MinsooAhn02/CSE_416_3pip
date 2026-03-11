import { TrendingUp } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const StocksWidget = () => {
	const { isDark } = useTheme();
	const stocks = useDataStore((s) => s.stocks);

	return (
		<WidgetCard title="주식/환율" icon={TrendingUp} widgetId="stocks">
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
		</WidgetCard>
	);
};

export default StocksWidget;
