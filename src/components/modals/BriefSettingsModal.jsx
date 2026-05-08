import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";

const BriefSettingsModal = () => {
	const { i18n } = useTranslation();
	const { isDark, muted } = useTheme();
	const {
		showBriefSettings,
		tone,
		bLen,
		setShowBriefSettings,
		setTone,
		setBLen,
	} = useSettingsStore();
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const copy = isKo
		? {
				title: "🤖 AI 브리핑 설정",
				tone: "톤앤매너",
				length: "요약 길이",
				save: "저장",
				tones: {
					friendly: "친절한 😊",
					professional: "냉철한 📊",
					humorous: "유머러스 😄",
				},
				lengths: {
					short: "짧게",
					medium: "보통",
					long: "자세히",
				},
		  }
		: {
				title: "🤖 AI Briefing Settings",
				tone: "Tone",
				length: "Summary length",
				save: "Save",
				tones: {
					friendly: "Friendly 😊",
					professional: "Professional 📊",
					humorous: "Humorous 😄",
				},
				lengths: {
					short: "Short",
					medium: "Medium",
					long: "Detailed",
				},
		  };

	if (!showBriefSettings) return null;

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div
				className={`w-full max-w-md rounded-3xl shadow-2xl border p-6 ${
					isDark
						? "bg-slate-800 border-white/20 text-white"
						: "bg-white border-gray-200 text-slate-800"
				}`}
			>
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-bold">{copy.title}</h2>
					<button onClick={() => setShowBriefSettings(false)}>
						<X size={20} className="opacity-60 hover:opacity-100" />
					</button>
				</div>
				<div className="space-y-5">
					<div>
						<p className="text-sm font-medium mb-2">{copy.tone}</p>
						<div className="grid grid-cols-3 gap-2">
							{[
								{ id: "friendly", label: copy.tones.friendly },
								{ id: "professional", label: copy.tones.professional },
								{ id: "humorous", label: copy.tones.humorous },
							].map((t) => (
								<button
									key={t.id}
									onClick={() => setTone(t.id)}
									className={`p-2 rounded-xl text-xs border-2 transition-all ${
										tone === t.id
											? "border-blue-500 bg-blue-500/20"
											: isDark
												? "border-white/10 bg-white/5"
												: "border-gray-200 bg-gray-50"
									}`}
								>
									{t.label}
								</button>
							))}
						</div>
					</div>
					<div>
						<p className="text-sm font-medium mb-2">{copy.length}</p>
						<div className="grid grid-cols-3 gap-2">
							{[
								{ id: "short", label: copy.lengths.short },
								{ id: "medium", label: copy.lengths.medium },
								{ id: "long", label: copy.lengths.long },
							].map((l) => (
								<button
									key={l.id}
									onClick={() => setBLen(l.id)}
									className={`p-2 rounded-xl text-xs border-2 transition-all ${
										bLen === l.id
											? "border-blue-500 bg-blue-500/20"
											: isDark
												? "border-white/10 bg-white/5"
												: "border-gray-200 bg-gray-50"
									}`}
								>
									{l.label}
								</button>
							))}
						</div>
					</div>
				</div>
				<button
					onClick={() => setShowBriefSettings(false)}
					className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors"
				>
					{copy.save}
				</button>
			</div>
		</div>
	);
};

export default BriefSettingsModal;
