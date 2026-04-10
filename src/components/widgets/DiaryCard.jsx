import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";

const todayStr = () => new Date().toISOString().slice(0, 10);

const DiaryCard = () => {
	const { cardCls, cardShadowCls, isDark, inputCls, secondaryBgCls } =
		useTheme();
	const { t } = useTranslation();
	const [diaryText, setDiaryText] = useState("");

	const addAnswer = useDiaryStore((s) => s.addAnswer);
	const getAnswers = useDiaryStore((s) => s.getAnswers);
	const savedEntries = getAnswers(todayStr());

	const handleSave = () => {
		if (!diaryText.trim()) return;
		addAnswer(todayStr(), diaryText.trim());
		setDiaryText("");
	};

	return (
		<div
			className={`rounded-2xl border p-5 ${cardShadowCls} transition-colors duration-300 max-h-[400px] flex flex-col ${cardCls}`}
		>
			<p className="font-bold text-sm mb-3">{t("diary.question")}</p>
			<textarea
				className={`w-full h-24 border rounded-lg p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/30 transition-all flex-shrink-0 ${inputCls}`}
				value={diaryText}
				onChange={(e) => setDiaryText(e.target.value)}
				placeholder={t("diary.placeholder")}
			/>
			<button
				onClick={handleSave}
				className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex-shrink-0"
			>
				{t("common.confirm")}
			</button>

			{savedEntries.length > 0 && (
				<div className="mt-4 flex-1 min-h-0 overflow-y-auto diary-scroll space-y-2">
					{savedEntries.map((text, idx) => (
						<div
							key={idx}
							className={`text-xs p-2 rounded-lg ${secondaryBgCls}`}
						>
							<p>{text}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default DiaryCard;
