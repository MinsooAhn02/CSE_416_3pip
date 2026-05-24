import { memo, useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useDataStore } from "../../store/useDataStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useFontSize } from "../../hooks/useFontSize";
import { generatePersonalizedQuestion } from "../../services/aiService";
import { formatLocalDate } from "../../utils/date";

const STOP_WORDS = new Set(["이","그","저","것","수","을","를","이","가","은","는","에","의","도","로","와","과","만","에서","으로","한","있","없","하","이다","아","어","야"]);

const extractKeywords = (text: string): string[] =>
	text.split(/[\s,.!?;:()\[\]{}<>'"\/\\]+/)
		.map((w) => w.replace(/[^가-힣a-zA-Z0-9]/g, "").toLowerCase())
		.filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
		.slice(0, 5);

const todayStr = (): string => formatLocalDate();

// ── Component ─────────────────────────────────────────────────────────────────

const DiaryCard = () => {
	const { cardCls, cardShadowCls, isDark, inputCls, muted } = useTheme();
	const { body: bodyStyle } = useFontSize();
	const { t, i18n } = useTranslation();

	const addAnswer = useDiaryStore((s) => s.addAnswer);
	const persona = useOnboardingStore((s) => s.persona);
	const weather = useDataStore((s) => s.weather);
	const fixedInterestIds = useSettingsStore((s) => s.fixedInterestIds) || [];
	const bumpKeyword = useSettingsStore((s) => s.bumpKeyword);

	const [question, setQuestion] = useState<string | null>(null);
	const [isLoadingQ, setIsLoadingQ] = useState<boolean>(true);
	const [answerText, setAnswerText] = useState<string>("");
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [saved, setSaved] = useState<boolean>(false);
	const [saveError, setSaveError] = useState<boolean>(false);

	// 이번 세션에 물어본 질문 목록 + 언어별 캐시 (중복 방지 + 언어 전환 시 재호출 방지)
	const askedRef = useRef<string[]>([]);
	const questionCacheRef = useRef<Record<string, string>>({}); // { ko: "...", en: "..." }
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
			const trimmedAnswer = answerText.trim();
			await addAnswer(todayStr(), question, trimmedAnswer);
			// 답변에서 키워드 추출 → 관심사 score bump
			extractKeywords(trimmedAnswer).forEach((kw) => bumpKeyword(kw, "qa", 5));
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

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
			<div className="flex-shrink-0 flex items-center gap-2 mb-4">
				<MessageCircle size={16} className="text-blue-400" />
				<h2 className="font-bold text-sm">{t("diary.daily_question_title")}</h2>
			</div>

			{/* 질문 영역 — 질문이 길어질 경우 max-h 40%에서 내부 스크롤, textarea 침범 방지 */}
			<div className="flex-shrink-0 max-h-[40%] overflow-y-auto mb-4 min-h-[1.5rem]">
				{isLoadingQ ? (
					<div className="flex items-center gap-2">
						<Loader2 size={14} className={`animate-spin ${muted}`} />
						<span className={`text-xs ${muted}`}>
							{t("diary.daily_question_loading")}
						</span>
					</div>
				) : (
					<p className="font-medium leading-relaxed" style={bodyStyle}>{question}</p>
				)}
			</div>

			{/* 답변 입력 */}
			<textarea
				className={`w-full flex-1 min-h-[3rem] border rounded-xl p-3 resize-none overflow-hidden outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${inputCls} ${
					saved ? "opacity-50" : ""
				}`}
				value={answerText}
				onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswerText(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={t("diary.daily_question_placeholder")}
				disabled={isLoadingQ || isSaving || saved}
				style={bodyStyle}
			/>

			{/* 하단: 저장 상태 + 버튼 */}
			<div className="flex-shrink-0 mt-3 flex items-center justify-between">
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

export default memo(DiaryCard);
