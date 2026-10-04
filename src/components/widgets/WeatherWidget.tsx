import React, { memo, useState } from "react";
import { Sun, Droplets, Wind, Cloud, RefreshCw, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useFontSize } from "../../hooks/useFontSize";
import WidgetCard from "../common/WidgetCard";

const toFahrenheit = (celsius: number) => Math.round((celsius * 9) / 5 + 32);

const KO_CITY_MAP: Record<string, string> = {
	"seoul": "서울", "incheon": "인천", "busan": "부산", "daegu": "대구",
	"daejeon": "대전", "gwangju": "광주", "ulsan": "울산", "suwon": "수원",
	"seongnam": "성남", "goyang": "고양", "yongin": "용인", "changwon": "창원",
	"jeonju": "전주", "cheongju": "청주", "cheonan": "천안", "ansan": "안산",
	"bucheon": "부천", "anyang": "안양", "pohang": "포항", "jeju": "제주",
	"jeju city": "제주시", "gyeongju": "경주", "gimhae": "김해", "gumi": "구미",
	"iksan": "익산", "jinju": "진주", "wonju": "원주", "chuncheon": "춘천",
	"sokcho": "속초", "gangneung": "강릉", "andong": "안동", "pyeongtaek": "평택",
	"osan": "오산", "siheung": "시흥", "hwaseong": "화성", "paju": "파주",
	"hanam": "하남", "namyangju": "남양주", "uijeongbu": "의정부",
};

const getKoCityName = (city: string | undefined): string => {
	if (!city) return "";
	return KO_CITY_MAP[city.toLowerCase()] ?? city;
};

// OpenWeather condition id → 한국어 매핑
// https://openweathermap.org/weather-conditions
const KO_CONDITION_MAP: Record<number, string> = {
	200: "약한 뇌우", 201: "뇌우", 202: "강한 뇌우", 210: "약한 천둥", 211: "천둥",
	212: "강한 천둥", 221: "불규칙 뇌우", 230: "이슬비 뇌우", 231: "이슬비 뇌우", 232: "강한 이슬비 뇌우",
	300: "약한 이슬비", 301: "이슬비", 302: "강한 이슬비", 310: "약한 이슬비 비", 311: "이슬비 비",
	312: "강한 이슬비 비", 313: "소나기 이슬비", 314: "강한 소나기 이슬비", 321: "소나기 이슬비",
	500: "약한 비", 501: "보통 비", 502: "강한 비", 503: "매우 강한 비", 504: "극심한 비",
	511: "어는 비", 520: "약한 소나기", 521: "소나기", 522: "강한 소나기", 531: "불규칙 소나기",
	600: "약한 눈", 601: "눈", 602: "폭설", 611: "진눈깨비", 612: "약한 진눈깨비 소나기",
	613: "진눈깨비 소나기", 615: "약한 비와 눈", 616: "비와 눈", 620: "약한 눈 소나기",
	621: "눈 소나기", 622: "강한 눈 소나기",
	701: "안개", 711: "연기", 721: "실안개", 731: "모래 회오리", 741: "짙은 안개",
	751: "모래", 761: "먼지", 762: "화산재", 771: "돌풍", 781: "토네이도",
	800: "맑음", 801: "구름 조금", 802: "구름 산재", 803: "구름 많음", 804: "흐림",
};

const KO_CONDITION_STRING_MAP: Record<string, string> = {
	"clear sky": "맑음",
	"few clouds": "구름 조금",
	"scattered clouds": "구름 산재",
	"broken clouds": "구름 많음",
	"overcast clouds": "흐림",
	"light rain": "약한 비",
	"moderate rain": "보통 비",
	"heavy intensity rain": "강한 비",
	"very heavy rain": "매우 강한 비",
	"extreme rain": "극심한 비",
	"freezing rain": "어는 비",
	"light intensity shower rain": "약한 소나기",
	"shower rain": "소나기",
	"heavy intensity shower rain": "강한 소나기",
	"ragged shower rain": "불규칙 소나기",
	"light snow": "약한 눈",
	"snow": "눈",
	"heavy snow": "폭설",
	"sleet": "진눈깨비",
	"light shower sleet": "약한 진눈깨비 소나기",
	"shower sleet": "진눈깨비 소나기",
	"light rain and snow": "약한 비와 눈",
	"rain and snow": "비와 눈",
	"light shower snow": "약한 눈 소나기",
	"shower snow": "눈 소나기",
	"heavy shower snow": "강한 눈 소나기",
	"mist": "안개",
	"smoke": "연기",
	"haze": "실안개",
	"sand/dust whirls": "모래 회오리",
	"fog": "짙은 안개",
	"sand": "모래",
	"dust": "먼지",
	"volcanic ash": "화산재",
	"squalls": "돌풍",
	"tornado": "토네이도",
	"light drizzle": "약한 이슬비",
	"drizzle": "이슬비",
	"heavy intensity drizzle": "강한 이슬비",
	"thunderstorm with light rain": "약한 뇌우",
	"thunderstorm with rain": "뇌우",
	"thunderstorm with heavy rain": "강한 뇌우",
	"light thunderstorm": "약한 천둥",
	"thunderstorm": "천둥",
	"heavy thunderstorm": "강한 천둥",
};

const getKoCondition = (conditionId: number | null | undefined, condition: string): string => {
	if (conditionId != null && KO_CONDITION_MAP[conditionId]) {
		return KO_CONDITION_MAP[conditionId];
	}
	const lower = condition?.toLowerCase?.() ?? "";
	return KO_CONDITION_STRING_MAP[lower] ?? condition;
};

const WeatherWidget = () => {
	const { isDark, secondaryBgCls } = useTheme();
	const { body: bodyStyle } = useFontSize();
	const { t, i18n } = useTranslation();
	const isKo = i18n.language?.startsWith("ko");
	// Consolidated data-field selector — one subscription, shallow equality
	const { weather, loading, error, apiStatus, usingDefaultLocation, manualWeatherCity, initialFetchDone } =
		useDataStore(useShallow((s) => ({
			weather: s.weather,
			loading: s.loading.weather,
			error: s.errors.weather,
			apiStatus: s.apiStatus.weather ?? null,
			usingDefaultLocation: s.usingDefaultWeatherLocation,
			manualWeatherCity: s.manualWeatherCity,
			initialFetchDone: s.initialFetchDone,
		})));
	// Actions are stable Zustand references — separate subscriptions cause no extra renders
	const fetchWeather = useDataStore((s) => s.fetchWeather);
	const setManualWeatherCity = useDataStore((s) => s.setManualWeatherCity);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const tempUnit = useSettingsStore((s) => s.tempUnit);
	const setTempUnit = useSettingsStore((s) => s.setTempUnit);

	const [showCityInput, setShowCityInput] = useState(false);
	const [cityInput, setCityInput] = useState("");
	const [cityError, setCityError] = useState("");
	const [cityLoading, setCityLoading] = useState(false);

	const formatLastUpdated = (minutes: number | null | undefined) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("weather"));

	const handleCitySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
			{/* 첫 fetch 전(캐시 로딩 중)에는 '데이터 없음' 대신 로딩 표시 */}
			{loading || (!weather && !error && !initialFetchDone) ? (
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
								<p
									className={isDark ? "text-gray-400" : "text-slate-500"}
									style={bodyStyle}
								>
									{isKo ? getKoCityName(weather.city) : weather.city} · {isKo ? getKoCondition(weather.conditionId, weather.condition) : weather.condition}
								</p>
								{(usingDefaultLocation || manualWeatherCity) && (
									<div className="mt-1">
										{manualWeatherCity?.lat != null ? (
											<button
												onClick={() => setShowCityInput(true)}
												className={`text-[10px] flex items-center gap-1 ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-500 hover:text-blue-600"}`}
											>
												<MapPin size={9} /> {manualWeatherCity.displayName} ·
												{t("widgets.weather.change_city")}
											</button>
										) : (
											<button
												onClick={() => setShowCityInput(true)}
												className={`text-[10px] flex items-center gap-1 ${isDark ? "text-yellow-500 hover:text-yellow-400" : "text-amber-500 hover:text-amber-600"}`}
											>
												<MapPin size={9} /> {t("widgets.weather.default_location")} — {t("widgets.weather.set_city")}
											</button>
										)}
									</div>
								)}
								{showCityInput && (
									<form
										onSubmit={handleCitySubmit}
										className="mt-1.5 flex items-center gap-1"
									>
										<input
											autoFocus
											type="text"
											value={cityInput}
											onChange={(e) => setCityInput(e.target.value)}
											placeholder={t("widgets.weather.city_placeholder")}
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
											{t("widgets.weather.set")}
										</button>
										{manualWeatherCity?.lat != null && (
											<button
												type="button"
												onClick={handleClearCity}
												className={`text-[11px] px-2 py-0.5 rounded ${isDark ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-600"}`}
											>
												{t("widgets.weather.auto_detect")}
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
								{showCityInput && cityError && (
									<p className="mt-1 text-[11px] text-red-500" role="alert">{cityError}</p>
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
							<p className="font-medium" style={bodyStyle}>{weather.humidity}%</p>
							<p
								className={isDark ? "text-gray-400" : "text-slate-400"}
								style={bodyStyle}
							>
								{t("widgets.weather.humidity")}
							</p>
						</div>
						<div className={`p-2 rounded-lg text-center ${secondaryBgCls}`}>
							<Cloud size={14} className="mx-auto mb-1 text-gray-400" />
							<p className="font-medium" style={bodyStyle}>{weather.precipitation}%</p>
							<p
								className={isDark ? "text-gray-400" : "text-slate-400"}
								style={bodyStyle}
							>
								{t("widgets.weather.precipitation")}
							</p>
						</div>
						<div className={`p-2 rounded-lg text-center ${secondaryBgCls}`}>
							<Wind size={14} className="mx-auto mb-1 text-green-400" />
							<p className="font-medium" style={bodyStyle}>{
								weather.airQualityIndex != null
									? t(`widgets.weather.aqi.${["unknown","good","fair","moderate","poor","very_poor"][weather.airQualityIndex] ?? "unknown"}`)
									: t("widgets.weather.aqi.unknown")
							}</p>
							<p
								className={isDark ? "text-gray-400" : "text-slate-400"}
								style={bodyStyle}
							>
								{t("widgets.weather.air_quality")}
							</p>
						</div>
					</div>
				</div>
			) : error ? (
				<p className="text-[11px] text-red-400">{error}</p>
			) : (
				<p className="text-[11px] text-red-400">
					{t("widgets.weather.no_data")}
				</p>
			)}
		</WidgetCard>
	);
};

export default memo(WeatherWidget);
