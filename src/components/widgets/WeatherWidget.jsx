import { Sun, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import WidgetCard from "../common/WidgetCard";

const toFahrenheit = (celsius) => Math.round((celsius * 9) / 5 + 32);

const formatLastUpdated = (minutes) => {
	if (minutes == null) return "갱신 전";
	if (minutes <= 0) return "방금 갱신";
	return `${minutes}분 전`;
};

const WeatherWidget = () => {
	const { isDark } = useTheme();
	const weather = useDataStore((s) => s.weather);
	const loading = useDataStore((s) => s.loading.weather);
	const error = useDataStore((s) => s.errors.weather);
	const rawWeather = useDataStore((s) => s.rawData.weather);
	const fetchWeather = useDataStore((s) => s.fetchWeather);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const tempUnit = useSettingsStore((s) => s.tempUnit);
	const setTempUnit = useSettingsStore((s) => s.setTempUnit);

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("weather"));
	const displayTemp = weather
		? tempUnit === "f"
			? toFahrenheit(weather.temp)
			: weather.temp
		: null;
	const unitLabel = tempUnit === "f" ? "°F" : "°C";

	return (
		<WidgetCard
			title="현재 날씨"
			icon={Sun}
			widgetId="weather"
			headerMeta={lastUpdatedText}
			onRefresh={() => fetchWeather()}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
		>
			{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
			{weather ? (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Sun
							size={28}
							className={isDark ? "text-yellow-300" : "text-amber-500"}
						/>
						<p className="text-3xl font-bold">
							{displayTemp}
							{unitLabel}
						</p>
					</div>
					<div className="flex items-center gap-1">
						<button
							onClick={() => setTempUnit("c")}
							className={`text-xs px-2 py-1 rounded-md ${
								tempUnit === "c"
									? "bg-blue-500 text-white"
									: isDark
										? "bg-white/10"
										: "bg-gray-100"
							}`}
						>
							C
						</button>
						<button
							onClick={() => setTempUnit("f")}
							className={`text-xs px-2 py-1 rounded-md ${
								tempUnit === "f"
									? "bg-blue-500 text-white"
									: isDark
										? "bg-white/10"
										: "bg-gray-100"
							}`}
						>
							F
						</button>
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
