import { useState } from "react";
import { useTheme } from "../../hooks/useTheme";

const DiaryCard = () => {
	const { cardCls, isDark } = useTheme();
	const [diaryText, setDiaryText] = useState("");
	const [savedEntries, setSavedEntries] = useState([]);

	const handleSave = () => {
		if (!diaryText.trim()) return;
		setSavedEntries((prev) => [...prev, { text: diaryText, date: new Date() }]);
		setDiaryText("");
	};

	return (
		<div
			className={`rounded-2xl border p-5 shadow-sm transition-colors duration-300 max-h-[400px] flex flex-col ${cardCls}`}
		>
			<p className="font-bold text-sm mb-3">
				오늘 가장 기분 좋았던 순간은 언제인가요?
			</p>
			<textarea
				className={`w-full h-24 border rounded-lg p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/30 transition-all flex-shrink-0 ${
					isDark
						? "bg-[#333333] border-[#444444] text-white placeholder:text-neutral-500"
						: "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-gray-400"
				}`}
				value={diaryText}
				onChange={(e) => setDiaryText(e.target.value)}
				placeholder="오늘의 이야기를 적어보세요..."
			/>
			<button
				onClick={handleSave}
				className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex-shrink-0"
			>
				확인
			</button>

			{savedEntries.length > 0 && (
				<div className="mt-4 flex-1 min-h-0 overflow-y-auto diary-scroll space-y-2">
					{savedEntries.map((entry, idx) => (
						<div
							key={idx}
							className={`text-xs p-2 rounded-lg ${isDark ? "bg-[#333333]" : "bg-gray-50"}`}
						>
							<p className="opacity-50 text-[10px] mb-1">
								{entry.date.toLocaleTimeString("ko-KR", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</p>
							<p>{entry.text}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default DiaryCard;
