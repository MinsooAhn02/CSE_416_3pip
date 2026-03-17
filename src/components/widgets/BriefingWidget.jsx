import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { mockBriefings } from "../../mock/data";

const BriefingWidget = () => {
	const { isDark, cardCls, muted } = useTheme();
	const tone = useSettingsStore((s) => s.tone);

	const briefing = useMemo(() => {
		return mockBriefings[tone] || mockBriefings.friendly;
	}, [tone]);

	const lines = briefing.detail
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	return (
		<div
			className={`h-full rounded-2xl border p-5 shadow-sm transition-colors duration-300 ${cardCls}`}
		>
			<div className="flex items-center gap-2 mb-4">
				<Sparkles size={18} className="text-blue-500" />
				<h2 className="font-bold text-sm">AI 브리핑</h2>
			</div>

			<p className={`text-xs uppercase tracking-widest mb-3 ${muted}`}>
				Morning Digest
			</p>

			<p className="text-sm font-medium mb-3">{briefing.summary}</p>

			<div className="space-y-2">
				{lines.map((line, idx) => (
					<p key={idx} className={`text-xs leading-relaxed ${muted}`}>
						{line}
					</p>
				))}
			</div>
		</div>
	);
};

export default BriefingWidget;
