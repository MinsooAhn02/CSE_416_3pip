import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useDataStore } from "../../store/useDataStore";
import { generatePersonalizedQuestion } from "../../services/aiService";

const todayStr = () => formatLocalDate();

const DiaryCard = () => {
	const { cardCls, cardShadowCls, isDark, inputCls, muted } = useTheme();

	const addAnswer = useDiaryStore((s) => s.addAnswer);
	const persona = useAuthStore((s) => s.persona);
	const weather = useDataStore((s) => s.weather);

	const [question, setQuestion] = useState(null);
	const [isLoadingQ, setIsLoadingQ] = useState(true);
	const [answerText, setAnswerText] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState(false);

	// 이번 세션에 물어본 질문 목록 (중복 방지)
	const askedRef = useRef([]);

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
			});
			if (q) {
				askedRef.current = [...askedRef.current, q];
				setQuestion(q);
			}
		} catch {
			setQuestion("지금 뭐 하고 계세요?");
		} finally {
			setIsLoadingQ(false);
		}
	};

	// 처음 마운트 시 질문 생성
	useEffect(() => {
		fetchNextQuestion();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleSubmit = async () => {
		if (!answerText.trim() || isSaving || !question) return;

		setIsSaving(true);
		setSaveError(false);
		try {
			await addAnswer(todayStr(), question, answerText.trim());
			setSaved(true);
			// 1.5초 후 다음 질문으로
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
			className={`rounded-2xl border p-5 ${cardShadowCls} transition-colors duration-300 ${cardCls}`}
		>
			{/* 헤더 */}
			<div className="flex items-center gap-2 mb-4">
				<MessageCircle size={16} className="text-blue-400" />
				<h2 className="font-bold text-sm">오늘의 질문</h2>
			</div>

			{/* 질문 영역 */}
			<div className="min-h-[44px] mb-4">
				{isLoadingQ ? (
					<div className="flex items-center gap-2">
						<Loader2 size={14} className={`animate-spin ${muted}`} />
						<span className={`text-xs ${muted}`}>질문 생성 중...</span>
					</div>
				) : (
					<p className="text-sm font-medium leading-relaxed">{question}</p>
				)}
			</div>

			{/* 답변 입력 */}
			<textarea
				className={`w-full h-20 border rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${inputCls} ${
					saved ? "opacity-50" : ""
				}`}
				value={answerText}
				onChange={(e) => setAnswerText(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="답변을 입력하세요 (Enter로 제출)"
				disabled={isLoadingQ || isSaving || saved}
			/>

			{/* 하단: 저장 상태 + 버튼 */}
			<div className="mt-3 flex items-center justify-between">
				{/* 저장 상태 표시 */}
				<div className="h-5">
					{saved && (
						<span className="flex items-center gap-1 text-xs text-emerald-400">
							<Check size={12} />
							저장됨 — 다음 질문 준비 중
						</span>
					)}
					{saveError && (
						<span className="text-xs text-red-400">저장 실패, 다시 시도해주세요</span>
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
						"확인"
					)}
				</button>
			</div>
		</div>
	);
};

export default DiaryCard;
