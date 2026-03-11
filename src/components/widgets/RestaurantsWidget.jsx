import { MapPin, Star } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { mockRestaurants } from "../../mock/data";
import WidgetCard from "../common/WidgetCard";

const RestaurantsWidget = () => {
	const { isDark, muted } = useTheme();

	return (
		<WidgetCard title="주변 맛집" icon={MapPin} widgetId="restaurants">
			<div className="space-y-2">
				{mockRestaurants.map((r, i) => (
					<div
						key={i}
						className={`flex items-center justify-between p-2 rounded-lg ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
					>
						<div>
							<p className="text-sm font-medium">{r.name}</p>
							<p className={`text-[10px] ${muted}`}>
								{r.category} · {r.distance} · {r.price}
							</p>
						</div>
						<div className="flex items-center gap-1">
							<Star size={10} className="text-yellow-400 fill-yellow-400" />
							<span className="text-xs font-bold">{r.rating}</span>
						</div>
					</div>
				))}
				<p className={`text-[10px] text-center ${muted}`}>
					⚠️ 지도 API 연동 시 실제 위치 기반 데이터로 대체됩니다
				</p>
			</div>
		</WidgetCard>
	);
};

export default RestaurantsWidget;
