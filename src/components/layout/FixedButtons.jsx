import { Settings, Lock, Unlock } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";

const FixedButtons = () => {
	const { isDark } = useTheme();
	const setShowSettings = useSettingsStore((s) => s.setShowSettings);
	const editMode = useWidgetStore((s) => s.editMode);
	const setEditMode = useWidgetStore((s) => s.setEditMode);

	return (
		<div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3">
			<button
				onClick={() => setEditMode((p) => !p)}
				title={editMode ? "편집 모드 끄기" : "위젯 배치 편집"}
				className={`w-12 h-12 backdrop-blur-md border rounded-full flex items-center justify-center transition-all shadow-lg group ${
					editMode
						? "bg-blue-500 border-blue-400 text-white ring-2 ring-blue-400/50 animate-pulse"
						: isDark
							? "bg-white/5 hover:bg-white/15 border-white/10"
							: "bg-white/50 hover:bg-white/80 border-gray-200"
				}`}
			>
				{editMode ? (
					<Unlock size={20} />
				) : (
					<Lock size={20} className="opacity-60" />
				)}
			</button>
			<button
				onClick={() => setShowSettings(true)}
				className={`w-12 h-12 backdrop-blur-md border rounded-full flex items-center justify-center transition-all shadow-lg group ${
					isDark
						? "bg-white/5 hover:bg-white/15 border-white/10"
						: "bg-white/50 hover:bg-white/80 border-gray-200"
				}`}
			>
				<Settings
					size={22}
					className="opacity-60 group-hover:rotate-45 transition-transform duration-500"
				/>
			</button>
		</div>
	);
};

export default FixedButtons;
