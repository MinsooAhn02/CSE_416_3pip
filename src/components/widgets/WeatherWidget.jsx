import { Sun, Droplets, Wind, Cloud, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import WidgetCard from "../common/WidgetCard";

const toFahrenheit = (celsius) => Math.round((celsius * 9) / 5 + 32);

const WeatherWidget = () => {
	const { isDark, secondaryBgCls } = useTheme();
	const { t } = useTranslation();
	const weather = useDataStore((s) => s.weather);
	const loading = useDataStore((s) => s.loading.weather);
	const error = useDataStore((s) => s.errors.weather);
	const apiStatus = useDataStore((s) => s.apiStatus.weather ?? null);
	const fetchWeather = useDataStore((s) => s.fetchWeather);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const tempUnit = useSettingsStore((s) => s.tempUnit);
	const setTempUnit = useSettingsStore((s) => s.setTempUnit);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("weather"));
	const displayTemp = weather
		? tempUnit === "f"
			? toFahrenheit(weather.temp)
			: weather.temp
		: null;
	const unitLabel = tempUnit === "f" ? "°F" : "°C";

	return (
		<WidgetCard
			title={t("widgets.weather.title")}
			icon={Sun}
			widgetId="weather"
			headerMeta={lastUpdatedText}
			onRefresh={() => fetchWeather(undefined, undefined, undefined, true)}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
			apiStatus={apiStatus}
			apiError={error}
		>
			{loading ? (
				<p className="text-sm opacity-50">{t("widgets.weather.loading")}</p>
			) : weather ? (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Sun
								size={28}
								className={isDark ? "text-yellow-300" : "text-amber-500"}
							/>
							<div>
								<p className="text-3xl font-bold">
									{displayTemp}
									{unitLabel}
								</p>
								<p className={`text-xs ${isDark ? "text-gray-400" : "text-slate-500"}`}>
									{weather.city} · {weather.condition}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setTempUnit("c")}
								className={`text-xs px-2 py-1 rounded-md ${
									tempUnit === "c" ? "bg-blue-500 text-white" : secondaryBgCls
								}`}
							>
								C
							</button>
							<button
								onClick={() => setTempUnit("f")}
								className={`text-xs px-2 py-1 rounded-md ${
									tempUnit === "f" ? "bg-blue-500 text-white" : secondaryBgCls
								}`}
							>
								F
							</button>
						</div>
					</div>

					<div className="grid grid-cols-3 gap-2">
						<div className={`p-2 rounded-lg text-center ${secondaryBgCls}`}>
							<Droplets size={14} className="mx-auto mb-1 text-blue-400" />
							<p className="text-xs font-medium">{weather.humidity}%</p>
							<p className={`text-[10px] ${isDark ? "text-gray-400" : "text-slate-400"}`}>{t("widgets.weather.humidity")}</p>
						</div>
						<div className={`p-2 rounded-lg text-center ${secondaryBgCls}`}>
							<Cloud size={14} className="mx-auto mb-1 text-gray-400" />
							<p className="text-xs font-medium">{weather.precipitation}%</p>
							<p className={`text-[10px] ${isDark ? "text-gray-400" : "text-slate-400"}`}>{t("widgets.weather.precipitation")}</p>
						</div>
						<div className={`p-2 rounded-lg text-center ${secondaryBgCls}`}>
							<Wind size={14} className="mx-auto mb-1 text-green-400" />
							<p className="text-xs font-medium">{weather.airQuality}</p>
							<p className={`text-[10px] ${isDark ? "text-gray-400" : "text-slate-400"}`}>{t("widgets.weather.air_quality")}</p>
						</div>
					</div>
				</div>
			) : error ? (
				<p className="text-[11px] text-red-400">{error}</p>
			) : (
				<p className="text-[11px] text-red-400">{t("widgets.weather.no_data")}</p>
			)}
		</WidgetCard>
	);
};

export default WeatherWidget;
