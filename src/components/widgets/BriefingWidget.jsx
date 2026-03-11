import { useState } from "react";
import { X, Volume2, VolumeX, Settings, GripVertical } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";
import { mockBriefings } from "../../mock/data";

const BriefingWidget = () => {
	const { isDark, muted } = useTheme();
	const tone = useSettingsStore((s) => s.tone);
	const bLen = useSettingsStore((s) => s.bLen);
	const setShowBriefSettings = useSettingsStore((s) => s.setShowBriefSettings);
	const closeWidget = useWidgetStore((s) => s.closeWidget);
	const editMode = useWidgetStore((s) => s.editMode);

	const [speaking, setSpeaking] = useState(false);

	const brief = mockBriefings[tone] || mockBriefings.friendly;

	const speakBrief = () => {
		if (speaking) {
			window.speechSynthesis.cancel();
			setSpeaking(false);
			return;
		}
		const u = new SpeechSynthesisUtterance(brief.detail);
		u.lang = "ko-KR";
		u.rate = bLen === "short" ? 1.2 : bLen === "long" ? 0.8 : 1;
		u.onend = () => setSpeaking(false);
		setSpeaking(true);
		window.speechSynthesis.speak(u);
	};

	return (
		<div
			className={`backdrop-blur-md border rounded-2xl p-6 shadow-xl flex flex-col items-center text-center relative h-full overflow-auto ${
				isDark
					? "bg-gradient-to-br from-blue-600/40 to-indigo-600/40 border-white/20 text-white"
					: "bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-200 text-slate-800"
			}`}
		>
			<div className="absolute top-4 right-4 flex items-center gap-1">
				{editMode && (
					<div className="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity text-blue-400">
						<GripVertical size={14} />
					</div>
				)}
				<button
					onClick={() => closeWidget("briefing")}
					className="opacity-40 hover:opacity-100 transition-opacity"
					title="위젯 끄기"
				>
					<X size={14} />
				</button>
			</div>
			<p className={`text-xs uppercase tracking-widest mb-2 ${muted}`}>
				Morning Digest
			</p>
			<h2 className="text-lg font-bold mb-2">{brief.summary}</h2>
			<p className={`text-xs mb-4 leading-relaxed ${muted}`}>
				{bLen === "short" ? brief.detail.split(".")[0] + "." : brief.detail}
			</p>
			<div className="flex gap-2">
				<button
					onClick={speakBrief}
					className={`px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors ${
						isDark
							? "bg-white text-blue-900 hover:bg-blue-50"
							: "bg-blue-600 text-white hover:bg-blue-700"
					}`}
				>
					{speaking ? (
						<>
							<VolumeX size={16} /> 중지
						</>
					) : (
						<>
							<Volume2 size={16} /> 브리핑 듣기
						</>
					)}
				</button>
				<button
					onClick={() => setShowBriefSettings(true)}
					className={`px-3 py-2 rounded-full text-sm transition-colors ${isDark ? "bg-white/20 hover:bg-white/30" : "bg-blue-200 hover:bg-blue-300"}`}
				>
					<Settings size={14} />
				</button>
			</div>
		</div>
	);
};

export default BriefingWidget;
