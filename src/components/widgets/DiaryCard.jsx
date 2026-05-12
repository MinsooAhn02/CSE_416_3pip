import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useDataStore } from "../../store/useDataStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { generatePersonalizedQuestion } from "../../services/aiService";
import { formatLocalDate } from "../../utils/date";

const todayStr = () => formatLocalDate();

const DiaryCard = () => {
	const { cardCls, cardShadowCls, isDark, inputCls, muted } = useTheme();
	const { t, i18n } = useTranslation();

	const addAnswer = useDiaryStore((s) => s.addAnswer);
	const persona = useAuthStore((s) => s.persona);
	const weather = useDataStore((s) => s.weather);
	const fixedInterestIds = useSettingsStore((s) => s.fixedInterestIds) || [];

	const [question, setQuestion] = useState(null);
	const [isLoadingQ, setIsLoadingQ] = useState(true);
	const [answerText, setAnswerText] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState(false);

	// 이번 세션에 물어본 질문 목록 + 언어별 캐시 (중복 방지 + 언어 전환 시 재호출 방지)
	const askedRef = useRef([]);
	const questionCacheRef = useRef({}); // { ko: "...", en: "..." }
	const questionLanguage = i18n.language?.toLowerCase().startsWith("ko")
		? "ko"
		: "en";

	const fetchNextQuestion = async () => {
		setIsLoadingQ(true);
		setAnswerText("");
		setSaved(false);
		setSaveError(false);
		try {
			const q = await generatePersonalizedQuestion({
				persona: typeof persona === "string" ? persona : "",
				city: weather?.city ?? "",
				weatherCondition: weather?.condition ?? "",
				previousQuestions: askedRef.current,
				language: questionLanguage,
				fixedInterestIds,
			});
			if (q) {
				askedRef.current = [...askedRef.current, q];
				questionCacheRef.current[questionLanguage] = q;
				setQuestion(q);
			}
		} catch {
			setQuestion(t("diary.daily_question_fallback"));
		} finally {
			setIsLoadingQ(false);
		}
	};

	useEffect(() => {
		const cached = questionCacheRef.current[questionLanguage];
		if (cached) {
			setQuestion(cached);
			setIsLoadingQ(false);
			return;
		}
		fetchNextQuestion();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [questionLanguage]);

	const handleSubmit = async () => {
		if (!answerText.trim() || isSaving || !question) return;

		setIsSaving(true);
		setSaveError(false);
		try {
			await addAnswer(todayStr(), question, answerText.trim());
			setIsSaving(false);
			setSaved(true);
			setTimeout(() => {
				fetchNextQuestion();
			}, 1500);
		} catch {
			setSaveError(true);
			setIsSaving(false);
		}
	};

	const handleKeyDown = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div
			className={`rounded-2xl border p-5 ${cardShadowCls} transition-colors duration-300 ${cardCls} h-full min-h-0 flex flex-col overflow-hidden`}
		>
			{/* 헤더 */}
			<div className="flex items-center gap-2 mb-4">
				<MessageCircle size={16} className="text-blue-400" />
				<h2 className="font-bold text-sm">{t("diary.daily_question_title")}</h2>
			</div>

			{/* 질문 영역 */}
			<div className="min-h-[44px] mb-4">
				{isLoadingQ ? (
					<div className="flex items-center gap-2">
						<Loader2 size={14} className={`animate-spin ${muted}`} />
						<span className={`text-xs ${muted}`}>
							{t("diary.daily_question_loading")}
						</span>
					</div>
				) : (
					<p className="text-sm font-medium leading-relaxed">{question}</p>
				)}
			</div>

			{/* 답변 입력 */}
			<textarea
				className={`w-full flex-1 min-h-[5.5rem] border rounded-xl p-3 text-sm resize-none overflow-hidden outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${inputCls} ${
					saved ? "opacity-50" : ""
				}`}
				value={answerText}
				onChange={(e) => setAnswerText(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={t("diary.daily_question_placeholder")}
				disabled={isLoadingQ || isSaving || saved}
			/>

			{/* 하단: 저장 상태 + 버튼 */}
			<div className="mt-3 flex items-center justify-between">
				{/* 저장 상태 표시 */}
				<div className="h-5">
					{saved && (
						<span className="flex items-center gap-1 text-xs text-emerald-400">
							<Check size={12} />
							{t("diary.daily_question_saved")}
						</span>
					)}
					{saveError && (
						<span className="text-xs text-red-400">
							{t("diary.daily_question_save_error")}
						</span>
					)}
				</div>

				<button
					onClick={handleSubmit}
					disabled={!answerText.trim() || isLoadingQ || isSaving || saved}
					className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
						!answerText.trim() || isLoadingQ || isSaving || saved
							? isDark
								? "bg-white/10 text-white/30 cursor-not-allowed"
								: "bg-gray-100 text-gray-400 cursor-not-allowed"
							: "bg-blue-500 hover:bg-blue-600 text-white"
					}`}
				>
					{isSaving ? (
						<Loader2 size={14} className="animate-spin" />
					) : (
						t("common.confirm")
					)}
				</button>
			</div>
		</div>
	);
};

export default DiaryCard;
