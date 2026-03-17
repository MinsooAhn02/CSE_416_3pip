import { Activity } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";

const HealthWidget = () => {
	const { isDark, muted } = useTheme();
	const healthData = useDataStore((s) => s.healthData);

	return (
		<WidgetCard title="건강 (Google Fit)" icon={Activity} widgetId="health">
			{healthData ? (
				<div className="space-y-3">
					<div className="flex justify-between items-center">
						<span className="text-xs">🚶 걸음</span>
						<span className="text-xs font-bold">
							{healthData.steps.toLocaleString()} /{" "}
							{healthData.stepsGoal.toLocaleString()}
						</span>
					</div>
					<div
						className={`w-full h-1.5 rounded-full ${isDark ? "bg-[#333333]" : "bg-gray-200"}`}
					>
						<div
							className="h-full bg-green-500 rounded-full"
							style={{
								width: `${(healthData.steps / healthData.stepsGoal) * 100}%`,
							}}
						/>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-xs">😴 수면</span>
						<span className="text-xs font-bold">
							{healthData.sleep}h / {healthData.sleepGoal}h
						</span>
					</div>
					<div
						className={`w-full h-1.5 rounded-full ${isDark ? "bg-[#333333]" : "bg-gray-200"}`}
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
							className={`text-center p-2 rounded-lg ${isDark ? "bg-[#333333]" : "bg-gray-50"}`}
						>
							<p className="text-lg font-bold">❤️ {healthData.heartRate}</p>
							<p className={`text-[10px] ${muted}`}>BPM</p>
						</div>
						<div
							className={`text-center p-2 rounded-lg ${isDark ? "bg-[#333333]" : "bg-gray-50"}`}
						>
							<p className="text-lg font-bold">🔥 {healthData.calories}</p>
							<p className={`text-[10px] ${muted}`}>kcal</p>
						</div>
						<div
							className={`text-center p-2 rounded-lg ${isDark ? "bg-[#333333]" : "bg-gray-50"}`}
						>
							<p className="text-lg font-bold">
								💧 {healthData.water}/{healthData.waterGoal}
							</p>
							<p className={`text-[10px] ${muted}`}>잔</p>
						</div>
					</div>
					<p className={`text-[10px] text-center mt-1 ${muted}`}>
						⚠️ Google Fit 연동 시 실제 데이터로 대체됩니다
					</p>
				</div>
			) : (
				<p className="text-sm opacity-50">건강 데이터 로딩 중...</p>
			)}
		</WidgetCard>
	);
};

export default HealthWidget;
