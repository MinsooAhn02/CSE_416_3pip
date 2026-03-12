import { MapPin, Star } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const RestaurantsWidget = () => {
	const { isDark, muted } = useTheme();
	const restaurants = useDataStore((s) => s.restaurants);
	const loading = useDataStore((s) => s.loading.restaurants);

	return (
		<WidgetCard title="주변 맛집" icon={MapPin} widgetId="restaurants">
			{loading ? (
				<p className="text-sm opacity-60">주변 맛집 데이터를 불러오는 중...</p>
			) : restaurants.length === 0 ? (
				<p className="text-sm opacity-60">표시할 맛집 데이터가 없습니다.</p>
			) : (
				<div className="space-y-2">
					{restaurants.map((r, i) => (
						<div
							key={i}
							className={`flex items-center justify-between p-2 rounded-lg ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
						>
							<div>
								<p className="text-sm font-medium">{r.name}</p>
								<p className={`text-[10px] ${muted}`}>
									{r.category} · {r.distance}
									{r.price ? ` · ${r.price}` : ""}
								</p>
								{r.address && (
									<p className={`text-[10px] mt-0.5 ${muted}`}>{r.address}</p>
								)}
							</div>
							{typeof r.rating === "number" ? (
								<div className="flex items-center gap-1">
									<Star size={10} className="text-yellow-400 fill-yellow-400" />
									<span className="text-xs font-bold">{r.rating}</span>
								</div>
							) : (
								<span className={`text-[10px] ${muted}`}>Kakao Local</span>
							)}
						</div>
					))}
					<p className={`text-[10px] text-center ${muted}`}>
						⚠️ Kakao Local 미연결 시 mock 데이터로 표시됩니다
					</p>
				</div>
			)}
		</WidgetCard>
	);
};

export default RestaurantsWidget;
