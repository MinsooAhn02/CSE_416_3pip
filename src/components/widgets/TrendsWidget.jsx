import { TrendingUp } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const TrendsWidget = () => {
	const { isDark } = useTheme();
	const trends = useDataStore((s) => s.trends);

	return (
		<WidgetCard title="실시간 트렌드" icon={TrendingUp} widgetId="trends">
			<div className="flex flex-wrap gap-2">
				{trends.map((tag, i) => (
					<span
						key={i}
						className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors border ${
							isDark
								? "bg-white/5 border-white/10 hover:bg-white/15"
								: "bg-gray-50 border-gray-200 hover:bg-gray-100"
						}`}
					>
						{tag}
					</span>
				))}
			</div>
		</WidgetCard>
	);
};

export default TrendsWidget;
