import { Sun, TrendingUp, Newspaper, CheckSquare } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import {
	mockWeather,
	mockStocks,
	mockTrends,
	mockTodos,
} from "../../mock/data";

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
		label: mockStocks[0].name,
		value: mockStocks[0].change,
		sub: mockStocks[0].value,
		color: mockStocks[0].up ? "text-green-500" : "text-red-500",
	},
	{
		icon: Newspaper,
		label: "뉴스",
		value: `${mockTrends.length} articles`,
		sub: "실시간 트렌드",
		color: "text-blue-500",
	},
	{
		icon: CheckSquare,
		label: "할 일",
		value: `${mockTodos.filter((t) => !t.completed).length}개 남음`,
		sub: `총 ${mockTodos.length}개`,
		color: "text-purple-500",
	},
];

const MiniWidgetGrid = () => {
	const { cardCls, muted } = useTheme();

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
