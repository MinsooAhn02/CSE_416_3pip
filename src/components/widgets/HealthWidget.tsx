import { memo } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useFontSize } from "../../hooks/useFontSize";
import WidgetCard from "../common/WidgetCard";

const HealthWidget = () => {
	const { isDark, muted, secondaryBgCls } = useTheme();
	const { body: bodyStyle } = useFontSize();
	const { t } = useTranslation();
	// Consolidated data-field selector — one subscription, shallow equality
	const { healthData, loading, error, apiStatus } = useDataStore(useShallow((s) => ({
		healthData: s.healthData,
		loading: s.loading.health,
		error: s.errors.health,
		apiStatus: s.apiStatus.health ?? null,
	})));
	// Actions are stable Zustand references — separate subscriptions cause no extra renders
	const fetchHealth = useDataStore((s) => s.fetchHealth);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const isRealData = apiStatus === "ok";

	const formatLastUpdated = (minutes: number | null | undefined) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("health"));

	return (
		<WidgetCard
			title={t("widgets.health.title")}
			icon={Activity}
			widgetId="health"
			headerMeta={lastUpdatedText}
			onRefresh={() => fetchHealth(undefined, true)}
			refreshing={!!loading}
			refreshIcon={RefreshCw}
			apiStatus={apiStatus}
			apiError={error}
		>
			{loading ? (
				<p className="text-sm opacity-50">{t("widgets.health.loading")}</p>
			) : healthData ? (
				<div className="space-y-3">
					<div className="flex justify-between items-center">
						<span style={bodyStyle}>🚶 {t("widgets.health.steps")}</span>
						<span className="font-bold" style={bodyStyle}>
							{healthData.steps.toLocaleString()} /{" "}
							{healthData.stepsGoal.toLocaleString()}
						</span>
					</div>
					<div className={`w-full h-1.5 rounded-full ${secondaryBgCls}`}>
						<div
							className="h-full bg-green-500 rounded-full"
							style={{
								width: `${(healthData.steps / healthData.stepsGoal) * 100}%`,
							}}
						/>
					</div>
					<div className="flex justify-between items-center">
						<span style={bodyStyle}>😴 {t("widgets.health.sleep")}</span>
						<span className="font-bold" style={bodyStyle}>
							{healthData.sleep}h / {healthData.sleepGoal}h
						</span>
					</div>
					<div className={`w-full h-1.5 rounded-full ${secondaryBgCls}`}>
						<div
							className="h-full bg-indigo-500 rounded-full"
							style={{
								width: `${(healthData.sleep / healthData.sleepGoal) * 100}%`,
							}}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2 mt-2">
						<div className={`text-center p-2 rounded-lg ${secondaryBgCls}`}>
							<p className="text-lg font-bold">❤️ {healthData.heartRate}</p>
							<p className={muted} style={bodyStyle}>BPM</p>
						</div>
						<div className={`text-center p-2 rounded-lg ${secondaryBgCls}`}>
							<p className="text-lg font-bold">🔥 {healthData.calories}</p>
							<p className={muted} style={bodyStyle}>kcal</p>
						</div>
						<div className={`text-center p-2 rounded-lg ${secondaryBgCls}`}>
							<p className="text-lg font-bold">
								💧 {healthData.water}/{healthData.waterGoal}
							</p>
							<p className={muted} style={bodyStyle}>
								{t("widgets.health.cups")}
							</p>
						</div>
					</div>
					{!isRealData && (
						<p className={`text-center mt-1 ${muted}`} style={bodyStyle}>
							{t("widgets.health.google_fit_notice")}
						</p>
					)}
				</div>
			) : error ? (
				<p className="text-[11px] text-red-400">{error}</p>
			) : (
				<p className="text-sm opacity-50">{t("widgets.health.loading")}</p>
			)}
		</WidgetCard>
	);
};

export default memo(HealthWidget);
