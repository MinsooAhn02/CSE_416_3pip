import { Sun, TrendingUp, Newspaper, CheckSquare } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import {
	mockWeather,
	mockStocks,
	mockTrends,
} from "../../mock/data";

const MiniWidgetGrid = () => {
	const { cardCls, muted } = useTheme();

	/* 실시간 데이터 (가능한 경우) 또는 mock fallback */
	const storeStocks = useDataStore((s) => s.stocks);
	const storeTrends = useDataStore((s) => s.trends);
	const todos = useTodoStore((s) => s.todos);

	const stocks = storeStocks?.length ? storeStocks : mockStocks;
	const trends = storeTrends?.length ? storeTrends : mockTrends;
	const pendingTodos = todos.filter((t) => !t.completed);

	const miniWidgets = [
		{
			icon: Sun,
			label: "날씨",
			value: `${mockWeather.temp}°C`,
			sub: mockWeather.condition,
			color: "text-yellow-500",
		},
		{
			icon: TrendingUp,
			label: stocks[0]?.name ?? "KOSPI",
			value: stocks[0]?.change ?? "--",
			sub: stocks[0]?.value ?? "--",
			color: stocks[0]?.up ? "text-green-500" : "text-red-500",
		},
		{
			icon: Newspaper,
			label: "뉴스",
			value: `${trends.length} articles`,
			sub: "실시간 트렌드",
			color: "text-blue-500",
		},
		{
			icon: CheckSquare,
			label: "할 일",
			value: `${pendingTodos.length}개 남음`,
			sub: `총 ${todos.length}개`,
			color: "text-purple-500",
		},
	];

	return (
		<div className="grid grid-cols-2 gap-3">
			{miniWidgets.map((w) => (
				<div
					key={w.label}
					className={`rounded-2xl border p-4 shadow-sm transition-colors duration-300 ${cardCls}`}
				>
					<div className="flex items-center gap-2 mb-2">
						<w.icon size={16} className={w.color} />
						<span className={`text-xs ${muted}`}>{w.label}</span>
					</div>
					<p className="text-lg font-bold">{w.value}</p>
					<p className={`text-xs ${muted}`}>{w.sub}</p>
				</div>
			))}
		</div>
	);
};

export default MiniWidgetGrid;
