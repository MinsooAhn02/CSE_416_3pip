import { Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const WeatherWidget = () => {
	const { muted } = useTheme();
	const weather = useDataStore((s) => s.weather);

	return (
		<WidgetCard title="현재 날씨" icon={Sun} widgetId="weather">
			{weather ? (
				<div className="flex items-center justify-between">
					<div>
						<p className="text-3xl font-bold">{weather.temp}°C</p>
						<p className={`text-xs ${muted}`}>
							{weather.city}, {weather.condition}
						</p>
					</div>
					<div className="text-right">
						<p className={`text-[10px] ${muted}`}>
							강수확률 {weather.precipitation}%
						</p>
						<p className={`text-[10px] ${muted}`}>
							미세먼지 {weather.airQuality}
						</p>
						<p className={`text-[10px] ${muted}`}>습도 {weather.humidity}%</p>
					</div>
				</div>
			) : (
				<p className="text-sm opacity-50">날씨 정보를 불러오는 중...</p>
			)}
		</WidgetCard>
	);
};

export default WeatherWidget;
