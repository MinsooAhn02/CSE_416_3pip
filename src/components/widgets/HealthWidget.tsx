import { memo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useAuthStore } from "../../store/useAuthStore";
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
	const fitEnabled = useOnboardingStore((s) => s.perms.fit);
	const savePerm = useOnboardingStore((s) => s.savePerm);
	const reconnectGoogle = useAuthStore((s) => s.reconnectGoogle);
	const [isReconnecting, setIsReconnecting] = useState(false);

	const handleEnableFit = async () => {
		await savePerm("fit", true);
		fetchHealth(undefined, true);
	};

	const handleReconnect = async () => {
		setIsReconnecting(true);
		try {
			await reconnectGoogle();
		} finally {
			setIsReconnecting(false);
		}
	};

	const formatLastUpdated = (minutes: number | null | undefined) => {
		if (minutes == null) return t("common.before_refresh");
		if (minutes <= 0) return t("common.just_now");
		return t("common.minutes_ago", { count: minutes });
	};

	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("health"));

	if (!fitEnabled) {
		return (
			<WidgetCard
				title={t("widgets.health.title")}
				icon={Activity}
				widgetId="health"
				apiStatus={null}
			>
				<div className="relative min-h-[140px]">
					<div className="blur-sm pointer-events-none select-none opacity-50 space-y-3">
						<div className={`h-4 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
						<div className={`h-2 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
						<div className={`h-4 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
						<div className={`h-2 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
						<div className="grid grid-cols-2 gap-2 mt-2">
							{[0, 1, 2].map((i) => (
								<div key={i} className={`h-14 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
							))}
						</div>
					</div>
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
						<Activity size={24} className="text-blue-400" />
						<p className={`text-xs text-center px-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
							{t("onboarding.enable_fit_desc")}
						</p>
						<button
							type="button"
							onClick={handleEnableFit}
							className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
						>
							{t("onboarding.enable_fit")}
						</button>
					</div>
				</div>
			</WidgetCard>
		);
	}

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
				<div className="space-y-2">
					<p className="text-[11px] text-red-400">{error}</p>
					<button
						type="button"
						onClick={handleReconnect}
						disabled={isReconnecting}
						className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white transition-colors"
					>
						{isReconnecting ? t("common.reconnecting") : t("common.reconnect_google")}
					</button>
				</div>
			) : (
				<p className="text-sm opacity-50">{t("widgets.health.loading")}</p>
			)}
		</WidgetCard>
	);
};

export default memo(HealthWidget);
