import { Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const WeatherWidget = () => {
	const { muted, isDark } = useTheme();
	const weather = useDataStore((s) => s.weather);
	const loading = useDataStore((s) => s.loading.weather);
	const error = useDataStore((s) => s.errors.weather);
	const rawWeather = useDataStore((s) => s.rawData.weather);

	return (
		<WidgetCard title="현재 날씨" icon={Sun} widgetId="weather">
			{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
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
			) : loading ? (
				<p className="text-sm opacity-50">날씨 정보를 불러오는 중...</p>
			) : (
				<p className="text-sm opacity-50">표시할 날씨 정보가 없습니다.</p>
			)}

			<details className="mt-3">
				<summary className="text-[11px] opacity-70 cursor-pointer">
					원본 API 데이터 (weather)
				</summary>
				<pre
					className={`mt-2 text-[10px] leading-relaxed p-2 rounded-lg overflow-auto max-h-48 ${
						isDark ? "bg-black/20" : "bg-gray-100"
					}`}
				>
					{JSON.stringify(rawWeather ?? weather, null, 2)}
				</pre>
			</details>
		</WidgetCard>
	);
};

export default WeatherWidget;
