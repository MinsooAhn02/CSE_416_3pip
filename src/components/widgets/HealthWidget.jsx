import { Activity, RefreshCw, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import { useAuthStore } from "../../store/useAuthStore";
import WidgetCard from "../common/WidgetCard";

const HealthWidget = () => {
	const { isDark, muted, secondaryBgCls } = useTheme();
	const { t } = useTranslation();
	const healthData  = useDataStore((s) => s.healthData);
	const apiStatus   = useDataStore((s) => s.apiStatus.health ?? null);
	const isRealData  = apiStatus === "ok";

	return (
		<WidgetCard
			title={t("widgets.health.title")}
			icon={Activity}
			widgetId="health"
			headerMeta={formatLastUpdated(getLastUpdatedMinutes("health"))}
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
						<span className="text-xs">🚶 {t("widgets.health.steps")}</span>
						<span className="text-xs font-bold">
							{healthData.steps.toLocaleString()} /{" "}
							{healthData.stepsGoal.toLocaleString()}
						</span>
					</div>
					<div
						className={`w-full h-1.5 rounded-full ${secondaryBgCls}`}
					>
						<div
							className="h-full bg-green-500 rounded-full"
							style={{
								width: `${(healthData.steps / healthData.stepsGoal) * 100}%`,
							}}
						/>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-xs">😴 {t("widgets.health.sleep")}</span>
						<span className="text-xs font-bold">
							{healthData.sleep}h / {healthData.sleepGoal}h
						</span>
					</div>
					<div
						className={`w-full h-1.5 rounded-full ${secondaryBgCls}`}
					>
						<div
							className="h-full bg-indigo-500 rounded-full"
							style={{
								width: `${(healthData.sleep / healthData.sleepGoal) * 100}%`,
							}}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2 mt-2">
						<div
							className={`text-center p-2 rounded-lg ${secondaryBgCls}`}
						>
							<p className="text-lg font-bold">❤️ {healthData.heartRate}</p>
							<p className={`text-[10px] ${muted}`}>BPM</p>
						</div>
						<div
							className={`text-center p-2 rounded-lg ${secondaryBgCls}`}
						>
							<p className="text-lg font-bold">🔥 {healthData.calories}</p>
							<p className={`text-[10px] ${muted}`}>kcal</p>
						</div>
						<div
							className={`text-center p-2 rounded-lg ${secondaryBgCls}`}
						>
							<p className="text-lg font-bold">
								💧 {healthData.water}/{healthData.waterGoal}
							</p>
							<p className={`text-[10px] ${muted}`}>{t("widgets.health.cups")}</p>
						</div>
					</div>
					{!isRealData && (
						<p className={`text-[10px] text-center mt-1 ${muted}`}>
							{t("widgets.health.google_fit_notice")}
						</p>
					)}
				</div>
			) : (
				<p className="text-sm opacity-50">{t("widgets.health.loading")}</p>
			)}
		</WidgetCard>
	);
};

export default HealthWidget;
