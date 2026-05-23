import { useEffect, useMemo, useState } from "react";
import { BookOpen, Lock, Edit2, RotateCcw, Save, Settings, X, ThumbsUp, ThumbsDown, RefreshCw, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useBriefingHistoryStore } from "../../store/useBriefingHistoryStore";
import { generateAndSaveDiaryForDate } from "../../services/diaryGenerationService";
import PINModal from "../modals/PINModal";
import ConfirmDialog from "../common/ConfirmDialog";

interface DiaryPanelProps {
	selectedDate: string | null;
	onClose?: () => void;
	compact?: boolean;
}

const DiaryPanel = ({ selectedDate, onClose, compact = false }: DiaryPanelProps) => {
	const { i18n } = useTranslation();
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls } = useTheme();
	const {
		getDiary,
		saveDiary,
		saveMemo,
		revertDiaryToGenerated,
		setFeedbackRating,
		applyFeedbackRewrite,
		confirmRewrite,
		discardPendingRewrite,
		pinSet,
		isPinAuthenticated,
		pinAuthExpiresAt,
		refreshPinAuthState,
		clearPinSession,
	} = useDiaryStore();
	const pinLockMode = useSettingsStore((state) => state.pinLockMode);
	const setShowSettings = useSettingsStore((state) => state.setShowSettings);
	const setSettingsTab = useSettingsStore((state) => state.setSettingsTab);
	const bumpKeyword = useSettingsStore((state) => state.bumpKeyword);
	const pinRequired = pinSet && pinLockMode !== "off";
	const safeDateStr = selectedDate ?? "";

	const currentEntry = getDiary(safeDateStr);
	const aiGeneratedDiary =
		currentEntry?.aiGeneratedDiary || currentEntry?.diary || "";
	const canEditDiary = !!(currentEntry?.diary || aiGeneratedDiary).trim();
	const canRevertDiary = !!(
		currentEntry?.editedDiary?.trim() && currentEntry?.aiGeneratedDiary?.trim()
	);

	const [showPinModal, setShowPinModal] = useState(false);
	const [isEditingDiary, setIsEditingDiary] = useState(false);
	const [isEditingMemo, setIsEditingMemo] = useState(false);
	const [diaryContent, setDiaryContent] = useState("");
	const [memoContent, setMemoContent] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [isGeneratingDiary, setIsGeneratingDiary] = useState(false);

	// Feedback state
	const [feedbackText, setFeedbackText] = useState("");
	const [isRewriting, setIsRewriting] = useState(false);
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const copy = useMemo(
		() =>
			isKo
				? {
						diaryTitle: "Diary",
						previewFallback: "이 날짜에는 아직 일기 내용이 없습니다.",
						lockDiary: "Diary 잠금",
						diarySettings: "Diary 설정",
						closeDiary: "Diary 닫기",
						lockedDiary: "Diary가 잠겨 있습니다.",
						pinRequired: "Diary를 열기 전에 PIN 설정이 필요합니다.",
						unlock: "잠금 해제",
						setupPin: "PIN 설정",
						aiDiaryLabel: "AI 생성 일기",
						revert: "되돌리기",
						revertTitle: "원래 AI 일기로 되돌리기",
						editDiary: "일기 편집",
						noDiary: "이 날짜에는 아직 AI 일기가 생성되지 않았습니다.",
						editDiaryPlaceholder: "일기 내용을 수정해보세요...",
						saving: "저장 중...",
						save: "저장",
						cancel: "취소",
						memo: "메모",
						editMemo: "메모 편집",
						clickMemo: "클릭해서 메모 추가...",
						memoPlaceholder: "메모를 입력해보세요...",
						feedbackLabel: "피드백",
						feedbackPlaceholder: "어떤 점을 개선하면 좋을까요?",
						rewrite: "재작성",
						rewriting: "재작성 중...",
						confirmRewrite: "확정",
						discardRewrite: "취소",
						confirmWarningTitle: "일기를 덮어쓰시겠습니까?",
						confirmWarningBody: "원본으로 되돌릴 수 없습니다.",
						pendingRewriteLabel: "재작성 미리보기",
				  }
				: {
						diaryTitle: "Diary",
						previewFallback: "No diary content for this date.",
						lockDiary: "Lock diary",
						diarySettings: "Diary settings",
						closeDiary: "Close diary",
						lockedDiary: "Diary is locked.",
						pinRequired: "Diary PIN is required before opening this diary.",
						unlock: "Unlock",
						setupPin: "Set up PIN",
						aiDiaryLabel: "AI Generated Diary",
						revert: "Revert",
						revertTitle: "Revert to original AI diary",
						editDiary: "Edit diary",
						noDiary: "No AI diary generated for this date yet.",
						editDiaryPlaceholder: "Edit diary content...",
						saving: "Saving...",
						save: "Save",
						cancel: "Cancel",
						memo: "Memo",
						editMemo: "Edit memo",
						clickMemo: "Click to add memo...",
						memoPlaceholder: "Write your memo here...",
						feedbackLabel: "Feedback",
						feedbackPlaceholder: "What would you like to improve?",
						rewrite: "Rewrite",
						rewriting: "Rewriting...",
						confirmRewrite: "Confirm",
						discardRewrite: "Discard",
						confirmWarningTitle: "Overwrite diary?",
						confirmWarningBody: "This cannot be undone.",
						pendingRewriteLabel: "Rewrite preview",
				  },
		[isKo],
	);

	const diaryUiText = useMemo(
		() =>
			i18n.language === "ko"
				? {
						generate: "일기 생성",
						regenerate: "다시 생성",
						generating: "생성 중...",
						generateTitle: "이 날짜의 일기 생성",
						regenerateTitle: "이 날짜의 일기 다시 생성",
				  }
				: {
						generate: "Generate Diary",
						regenerate: "Regenerate Diary",
						generating: "Generating...",
						generateTitle: "Generate diary for this date",
						regenerateTitle: "Regenerate diary for this date",
				  },
		[i18n.language],
	);

	useEffect(() => {
		setDiaryContent(currentEntry?.diary || "");
		setMemoContent(currentEntry?.notes || currentEntry?.memo || "");
		setIsEditingDiary(false);
		setIsEditingMemo(false);
	}, [selectedDate, currentEntry?.diary, currentEntry?.notes, currentEntry?.memo]);

	const isAuthenticated = !pinRequired || isPinAuthenticated;

	useEffect(() => {
		refreshPinAuthState?.();
	}, [pinLockMode, refreshPinAuthState]);

	useEffect(() => {
		return () => {
			if (pinRequired && pinLockMode === "immediate" && isAuthenticated) {
				clearPinSession();
			}
		};
	}, [pinRequired, pinLockMode, isAuthenticated, clearPinSession]);

	useEffect(() => {
		if (
			!pinRequired ||
			pinLockMode === "immediate" ||
			!isAuthenticated ||
			!pinAuthExpiresAt
		) {
			return undefined;
		}

		const remainingMs = pinAuthExpiresAt - Date.now();
		if (remainingMs <= 0) {
			refreshPinAuthState?.();
			return undefined;
		}

		const timerId = window.setTimeout(() => {
			refreshPinAuthState?.();
		}, remainingMs + 50);

		return () => window.clearTimeout(timerId);
	}, [
		pinRequired,
		pinLockMode,
		isAuthenticated,
		pinAuthExpiresAt,
		refreshPinAuthState,
	]);

	const handleSaveDiary = async () => {
		setIsSaving(true);
		try {
			await saveDiary(safeDateStr, diaryContent.trim());
			setIsEditingDiary(false);
		} catch (err) {
			console.error("Failed to save diary:", err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleRevertDiary = async () => {
		setIsSaving(true);
		try {
			await revertDiaryToGenerated(safeDateStr);
			setDiaryContent(aiGeneratedDiary);
			setIsEditingDiary(false);
		} catch (err) {
			console.error("Failed to revert diary:", err);
		} finally {
			setIsSaving(false);
		}
	};

	// 간단한 키워드 추출: 공백 분리 → 2자 이상, stop-word 제외 → 상위 5개
	const extractKeywordsFromNote = (text: string) => {
		const STOP = new Set(["이","그","저","것","수","을","를","이","가","은","는","에","의","도","로","와","과","도","만","에서","으로","한","했","있","없","하","했다","했는데","이다","아","어","야","했고","했지"]);
		return text
			.split(/[\s,.!?;:()\[\]{}<>'"\/\\]+/)
			.map((w: string) => w.replace(/[^가-힣a-zA-Z0-9]/g, "").toLowerCase())
			.filter((w: string) => w.length >= 2 && !STOP.has(w))
			.slice(0, 5);
	};

	const handleSaveMemo = async () => {
		setIsSaving(true);
		try {
			const trimmed = memoContent.trim();
			await saveMemo(safeDateStr, trimmed);
			setIsEditingMemo(false);
			// 키워드 추출 → 관심사 score bump
			if (trimmed) {
				extractKeywordsFromNote(trimmed).forEach((kw) => bumpKeyword(kw, "note", 10));
			}
		} catch (err) {
			console.error("Failed to save memo:", err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleGenerateDiary = async (overwrite = false) => {
		setIsGeneratingDiary(true);
		try {
			const snapshots = useBriefingHistoryStore.getState().getSnapshotsForDate(safeDateStr);
			await generateAndSaveDiaryForDate(safeDateStr, { overwrite, briefingSnapshots: snapshots });
			setIsEditingDiary(false);
		} catch (err) {
			console.error("Failed to generate diary:", err);
		} finally {
			setIsGeneratingDiary(false);
		}
	};

	const handleFeedbackRating = (rating: "like" | "dislike") => {
		setFeedbackRating(safeDateStr, rating);
	};

	const handleRewrite = async () => {
		if (!feedbackText.trim() || isRewriting) return;
		setIsRewriting(true);
		try {
			const language = i18n.language?.startsWith("ko") ? "ko" : "en";
			await applyFeedbackRewrite(safeDateStr, feedbackText.trim(), language);
			setFeedbackText("");
		} finally {
			setIsRewriting(false);
		}
	};

	const handleConfirmRewrite = async () => {
		await confirmRewrite(safeDateStr);
		setShowConfirmDialog(false);
	};

	const handleDiscardRewrite = () => {
		discardPendingRewrite(safeDateStr);
	};

	const handleLock = () => {
		clearPinSession();
	};

	const handleOpenDiarySettings = () => {
		setSettingsTab("diary");
		setShowSettings(true);
	};

	const formatDate = (dateStr: string | null) => {
		const d = new Date(`${dateStr}T00:00:00`);
		return d.toLocaleDateString(isKo ? "ko-KR" : "en-US", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			weekday: "short",
		});
	};

	if (compact) {
		const previewText =
			diaryContent || memoContent || copy.previewFallback;

		return (
			<div className={`rounded-xl border p-3 ${cardCls}`}>
				<div className="flex items-center justify-between gap-2 mb-2">
					<div className="flex items-center gap-2">
						<BookOpen size={15} className="text-blue-500" />
						<h3 className="font-bold text-xs">{copy.diaryTitle}</h3>
						{pinRequired && !isAuthenticated && (
							<Lock size={13} className="text-gray-500" />
						)}
					</div>
					<div className="flex items-center gap-1">
						{pinRequired && isAuthenticated && (
							<button
								onClick={handleLock}
								title={copy.lockDiary}
								className={`p-1 rounded-md transition-colors ${hoverCls}`}
							>
								<Lock size={14} />
							</button>
						)}
						{pinSet && (
							<button
								onClick={handleOpenDiarySettings}
								title={copy.diarySettings}
								className={`p-1 rounded-md transition-colors ${hoverCls}`}
							>
								<Settings size={14} />
							</button>
						)}
					</div>
				</div>

				{showPinModal && pinRequired && !isAuthenticated && (
					<PINModal
						mode={pinSet ? "verify" : "setup"}
						onSuccess={() => {
							setShowPinModal(false);
						}}
						onCancel={() => {
							setShowPinModal(false);
						}}
					/>
				)}

				{pinRequired && !isAuthenticated ? (
					<div
						className={`rounded-lg px-3 py-3 space-y-3 transition-all ${secondaryBgCls}`}
					>
						<div className="flex items-center gap-2">
							<Lock
								size={16}
								className={isDark ? "text-gray-500" : "text-gray-400"}
							/>
							<p
								className={`text-xs text-left ${isDark ? "text-gray-400" : "text-gray-600"}`}
							>
								{pinSet
									? copy.lockedDiary
									: copy.pinRequired}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setShowPinModal(true)}
							className="w-full rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
						>
							{pinSet ? copy.unlock : copy.setupPin}
						</button>
					</div>
				) : (
					<div
						className={`h-12 rounded-lg px-3 flex items-center gap-3 ${secondaryBgCls}`}
					>
						<p
							className={`text-[11px] whitespace-nowrap ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							{formatDate(selectedDate)}
						</p>
						<p
							className={`text-xs truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}
						>
							{previewText}
						</p>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className={`rounded-xl border p-4 space-y-4 h-auto ${cardCls}`}>
			<div className="flex items-center justify-between gap-2 mb-4">
				<div className="flex items-center gap-2">
					<BookOpen size={16} className="text-blue-500" />
					<h3 className="font-bold text-sm">{copy.diaryTitle}</h3>
					{pinRequired && !isAuthenticated && (
						<Lock size={14} className="text-gray-500" />
					)}
				</div>
				<div className="flex items-center gap-1">
					{pinRequired && isAuthenticated && (
						<button
							onClick={handleLock}
							title={copy.lockDiary}
							className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
						>
							<Lock size={16} />
						</button>
					)}
					{pinSet && (
						<button
							onClick={handleOpenDiarySettings}
							title={copy.diarySettings}
							className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
						>
							<Settings size={16} />
						</button>
					)}
					{onClose && (
						<button
							onClick={onClose}
							title={copy.closeDiary}
							className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
						>
							<X size={16} />
						</button>
					)}
				</div>
			</div>

			{showPinModal && pinRequired && !isAuthenticated && (
				<PINModal
					mode={pinSet ? "verify" : "setup"}
					onSuccess={() => {
						setShowPinModal(false);
					}}
					onCancel={() => {
						setShowPinModal(false);
					}}
				/>
			)}

			{pinRequired && !isAuthenticated && (
				<div
					className={`h-[280px] rounded-lg flex flex-col items-center justify-center transition-all px-6 ${secondaryBgCls}`}
				>
					<Lock
						size={48}
						className={`mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}
					/>
					<p
						className={`text-xs font-medium text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}
					>
						{pinSet
							? copy.lockedDiary
							: copy.pinRequired}
					</p>
					<button
						type="button"
						onClick={() => setShowPinModal(true)}
						className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
					>
						{pinSet ? copy.unlock : copy.setupPin}
					</button>
				</div>
			)}

			{isAuthenticated && (
				<div className="space-y-4">
					<p
						className={`text-xs font-medium flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}
					>
						{formatDate(selectedDate)}
					</p>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label
								className={`text-xs font-medium block ${isDark ? "text-blue-300" : "text-blue-600"}`}
							>
								{copy.aiDiaryLabel}
							</label>
							<div className="flex items-center gap-1">
								<button
									onClick={() => handleGenerateDiary(!!currentEntry?.diary?.trim())}
									disabled={isSaving || isGeneratingDiary || isEditingDiary}
									className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${hoverCls}`}
									title={
										currentEntry?.diary?.trim()
											? diaryUiText.regenerateTitle
											: diaryUiText.generateTitle
									}
								>
									{isGeneratingDiary
										? diaryUiText.generating
										: currentEntry?.diary?.trim()
											? diaryUiText.regenerate
											: diaryUiText.generate}
								</button>
								{canRevertDiary && !isEditingDiary && (
									<button
										onClick={handleRevertDiary}
										disabled={isSaving}
										className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 ${hoverCls} disabled:opacity-50`}
										title={copy.revertTitle}
									>
										<RotateCcw size={13} />
										{copy.revert}
									</button>
								)}
								{canEditDiary && !isEditingDiary && (
									<button
										onClick={() => setIsEditingDiary(true)}
										className={`p-1 rounded-lg text-xs transition-colors ${hoverCls}`}
										title={copy.editDiary}
									>
										<Edit2 size={14} />
									</button>
								)}
							</div>
						</div>

						{!isEditingDiary ? (
							<div
								className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap min-h-[80px] transition-all ${secondaryBgCls} ${canEditDiary ? "cursor-pointer" : ""} ${canEditDiary ? hoverCls : ""}`}
								onClick={() => {
									if (canEditDiary) {
										setIsEditingDiary(true);
									}
								}}
							>
								{diaryContent || copy.noDiary}
							</div>
						) : (
							<div className="space-y-2">
								<textarea
									value={diaryContent}
									onChange={(e) => setDiaryContent(e.target.value)}
									rows={4}
									className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
									placeholder={copy.editDiaryPlaceholder}
								/>
								<div className="flex gap-2">
									<button
										onClick={handleSaveDiary}
										disabled={isSaving}
										className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
									>
										<Save size={14} />
										{isSaving ? copy.saving : copy.save}
									</button>
									<button
										onClick={() => {
											setDiaryContent(currentEntry?.diary || "");
											setIsEditingDiary(false);
										}}
										className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${`${secondaryBgCls} ${hoverCls}`}`}
									>
										{copy.cancel}
									</button>
								</div>
							</div>
						)}
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label
								className={`text-xs font-medium block ${isDark ? "opacity-70" : "text-gray-600"}`}
							>
								{copy.memo}
							</label>
							{!isEditingMemo && (
								<button
									onClick={() => setIsEditingMemo(true)}
									className={`p-1 rounded-lg text-xs transition-colors ${hoverCls}`}
									title={copy.editMemo}
								>
									<Edit2 size={14} />
								</button>
							)}
						</div>
						{!isEditingMemo ? (
							<div
								className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap min-h-[80px] cursor-pointer transition-all ${`${secondaryBgCls} ${hoverCls}`}`}
								onClick={() => setIsEditingMemo(true)}
							>
								{memoContent || copy.clickMemo}
							</div>
						) : (
							<div className="space-y-2">
								<textarea
									value={memoContent}
									onChange={(e) => setMemoContent(e.target.value)}
									rows={4}
									className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
									placeholder={copy.memoPlaceholder}
								/>
								<div className="flex gap-2">
									<button
										onClick={handleSaveMemo}
										disabled={isSaving}
										className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
									>
										<Save size={14} />
										{isSaving ? copy.saving : copy.save}
									</button>
									<button
										onClick={() => {
											setMemoContent(currentEntry?.notes || currentEntry?.memo || "");
											setIsEditingMemo(false);
										}}
										className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${`${secondaryBgCls} ${hoverCls}`}`}
									>
										{copy.cancel}
									</button>
								</div>
							</div>
						)}
					</div>

					{/* ── Feedback 섹션 (일기가 있을 때만 표시) ── */}
					{canEditDiary && !isEditingDiary && (
						<div className="space-y-2 pt-2 border-t border-white/10">
							<div className="flex items-center justify-between">
								<span className={`text-xs font-medium ${isDark ? "opacity-70" : "text-gray-600"}`}>
									{copy.feedbackLabel}
								</span>
								<div className="flex gap-1">
									<button
										onClick={() => handleFeedbackRating("like")}
										className={`p-1.5 rounded-lg transition-colors ${
											currentEntry?.feedback?.rating === "like"
												? "text-emerald-400 bg-emerald-500/20"
												: `${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} opacity-50 hover:opacity-100`
										}`}
										title="Like"
									>
										<ThumbsUp size={13} />
									</button>
									<button
										onClick={() => handleFeedbackRating("dislike")}
										className={`p-1.5 rounded-lg transition-colors ${
											currentEntry?.feedback?.rating === "dislike"
												? "text-red-400 bg-red-500/20"
												: `${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} opacity-50 hover:opacity-100`
										}`}
										title="Dislike"
									>
										<ThumbsDown size={13} />
									</button>
								</div>
							</div>

							{/* Dislike 선택 시 재작성 입력란 */}
							{currentEntry?.feedback?.rating === "dislike" && !currentEntry?.feedback?.pendingRewrite && (
								<div className="space-y-2">
									<textarea
										value={feedbackText}
										onChange={(e) => setFeedbackText(e.target.value)}
										rows={2}
										className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
										placeholder={copy.feedbackPlaceholder}
									/>
									<button
										onClick={handleRewrite}
										disabled={!feedbackText.trim() || isRewriting}
										className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
									>
										<RefreshCw size={13} className={isRewriting ? "animate-spin" : ""} />
										{isRewriting ? copy.rewriting : copy.rewrite}
									</button>
								</div>
							)}

							{/* pendingRewrite 미리보기 */}
							{currentEntry?.feedback?.pendingRewrite && (
								<div className="space-y-2">
									<p className={`text-xs font-medium ${isDark ? "opacity-70" : "text-gray-600"}`}>
										{copy.pendingRewriteLabel}
									</p>
									<div className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${secondaryBgCls} border border-blue-500/30`}>
										{currentEntry.feedback.pendingRewrite}
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => setShowConfirmDialog(true)}
											className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1"
										>
											<CheckCircle size={13} />
											{copy.confirmRewrite}
										</button>
										<button
											onClick={handleRewrite}
											disabled={isRewriting}
											className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${secondaryBgCls} ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} disabled:opacity-50`}
										>
											<RefreshCw size={13} className={isRewriting ? "animate-spin" : ""} />
											{isRewriting ? copy.rewriting : copy.rewrite}
										</button>
										<button
											onClick={handleDiscardRewrite}
											className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${secondaryBgCls} ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
										>
											{copy.discardRewrite}
										</button>
									</div>

									{/* 재작성 시 추가 피드백 입력란 */}
									<textarea
										value={feedbackText}
										onChange={(e) => setFeedbackText(e.target.value)}
										rows={2}
										className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
										placeholder={copy.feedbackPlaceholder}
									/>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* 확정 경고 모달 */}
			{showConfirmDialog && (
				<ConfirmDialog
					title={copy.confirmWarningTitle}
					message={copy.confirmWarningBody}
					onConfirm={handleConfirmRewrite}
					onCancel={() => setShowConfirmDialog(false)}
				/>
			)}
		</div>
	);
};

export default DiaryPanel;
