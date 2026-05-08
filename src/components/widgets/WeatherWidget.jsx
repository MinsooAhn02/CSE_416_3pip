import { Sun, Droplets, Wind, Cloud, RefreshCw, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
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
	const usingDefaultLocation = useDataStore((s) => s.usingDefaultWeatherLocation);
	const manualWeatherCity = useDataStore((s) => s.manualWeatherCity);
	const fetchWeather = useDataStore((s) => s.fetchWeather);
	const setManualWeatherCity = useDataStore((s) => s.setManualWeatherCity);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const tempUnit = useSettingsStore((s) => s.tempUnit);
	const setTempUnit = useSettingsStore((s) => s.setTempUnit);

	const [showCityInput, setShowCityInput] = useState(false);
	const [cityInput, setCityInput] = useState("");
	const [cityError, setCityError] = useState("");
	const [cityLoading, setCityLoading] = useState(false);

	const formatLastUpdated = (minutes) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("weather"));

	const handleCitySubmit = async (e) => {
		e.preventDefault();
		if (!cityInput.trim() || cityLoading) return;
		setCityLoading(true);
		setCityError("");
		const result = await setManualWeatherCity(cityInput.trim());
		setCityLoading(false);
		if (result?.ok === false) {
			setCityError(result.error || "City not found. Try a larger city name.");
			return;
		}
		setCityInput("");
		setShowCityInput(false);
		fetchWeather(undefined, undefined, undefined, true);
	};

	const handleClearCity = () => {
		setManualWeatherCity(null);
		setCityInput("");
		setShowCityInput(false);
		fetchWeather(undefined, undefined, undefined, true);
	};
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
								{(usingDefaultLocation || manualWeatherCity) && (
									<div className="mt-1">
										{manualWeatherCity?.lat != null ? (
											<button
												onClick={() => setShowCityInput(true)}
												className={`text-[10px] flex items-center gap-1 ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-500 hover:text-blue-600"}`}
											>
												<MapPin size={9} /> {manualWeatherCity.displayName} · Change
											</button>
										) : (
											<button
												onClick={() => setShowCityInput(true)}
												className={`text-[10px] flex items-center gap-1 ${isDark ? "text-yellow-500 hover:text-yellow-400" : "text-amber-500 hover:text-amber-600"}`}
											>
												<MapPin size={9} /> Default location — Set city
											</button>
										)}
									</div>
								)}
								{showCityInput && (
									<form onSubmit={handleCitySubmit} className="mt-1.5 flex items-center gap-1">
										<input
											autoFocus
											type="text"
											value={cityInput}
											onChange={(e) => setCityInput(e.target.value)}
											placeholder="e.g. Songdo, Incheon"
											className={`text-[11px] px-2 py-0.5 rounded border flex-1 min-w-0 outline-none ${
												isDark
													? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
													: "bg-white border-gray-300 text-gray-800 placeholder-gray-400"
											}`}
										/>
										<button
											type="submit"
											className="text-[11px] px-2 py-0.5 rounded bg-blue-500 text-white"
										>
											Set
										</button>
										{manualWeatherCity?.lat != null && (
											<button
												type="button"
												onClick={handleClearCity}
												className={`text-[11px] px-2 py-0.5 rounded ${isDark ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-600"}`}
											>
												Auto
											</button>
										)}
										<button
											type="button"
											onClick={() => setShowCityInput(false)}
											className={`text-[11px] px-1.5 py-0.5 rounded ${isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
										>
											✕
										</button>
									</form>
								)}
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
