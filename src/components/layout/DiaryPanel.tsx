import { useEffect, useState } from "react";
import { BookOpen, Lock, Edit2, RotateCcw, Save, Settings, X, ThumbsUp, ThumbsDown, RefreshCw, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "../../hooks/useTheme";
import { useFontSize } from "../../hooks/useFontSize";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useBriefingHistoryStore } from "../../store/useBriefingHistoryStore";
import { generateAndSaveDiaryForDate } from "../../services/diaryGenerationService";
import PINModal from "../modals/PINModal";
import DiaryUnlock from "../common/DiaryUnlock";

interface DiaryPanelProps {
	selectedDate: string | null;
	onClose?: () => void;
	compact?: boolean;
	skipPinCheck?: boolean;
}

const DiaryPanel = ({ selectedDate, onClose, compact = false, skipPinCheck = false }: DiaryPanelProps) => {
	const { t, i18n } = useTranslation();
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls } = useTheme();
	const { body: bodyStyle } = useFontSize();
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
		encryptionStatus,
	} = useDiaryStore(
		useShallow((s) => ({
			getDiary: s.getDiary,
			saveDiary: s.saveDiary,
			saveMemo: s.saveMemo,
			revertDiaryToGenerated: s.revertDiaryToGenerated,
			setFeedbackRating: s.setFeedbackRating,
			applyFeedbackRewrite: s.applyFeedbackRewrite,
			confirmRewrite: s.confirmRewrite,
			discardPendingRewrite: s.discardPendingRewrite,
			pinSet: s.pinSet,
			isPinAuthenticated: s.isPinAuthenticated,
			pinAuthExpiresAt: s.pinAuthExpiresAt,
			refreshPinAuthState: s.refreshPinAuthState,
			clearPinSession: s.clearPinSession,
			encryptionStatus: s.encryptionStatus,
		})),
	);
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
	const copy = {
		diaryTitle: "Diary",
		previewFallback: t("diary_panel.preview_fallback"),
		lockDiary: t("diary_panel.lock_diary"),
		diarySettings: t("diary_panel.diary_settings"),
		closeDiary: t("diary_panel.close_diary"),
		lockedDiary: t("diary_panel.locked_diary"),
		pinRequired: t("diary_panel.pin_required"),
		unlock: t("diary_panel.unlock"),
		setupPin: t("diary_panel.setup_pin"),
		aiDiaryLabel: t("diary_panel.ai_diary_label"),
		revert: t("diary_panel.revert"),
		revertTitle: t("diary_panel.revert_title"),
		editDiary: t("diary_panel.edit_diary"),
		noDiary: t("diary_panel.no_diary"),
		editDiaryPlaceholder: t("diary_panel.edit_diary_placeholder"),
		saving: t("diary_panel.saving"),
		save: t("diary_panel.save"),
		cancel: t("diary_panel.cancel"),
		memo: t("diary_panel.memo"),
		editMemo: t("diary_panel.edit_memo"),
		clickMemo: t("diary_panel.click_memo"),
		memoPlaceholder: t("diary_panel.memo_placeholder"),
		feedbackLabel: t("diary_panel.feedback_label"),
		feedbackPlaceholder: t("diary_panel.feedback_placeholder"),
		rewrite: t("diary_panel.rewrite"),
		rewriting: t("diary_panel.rewriting"),
		confirmRewrite: t("diary_panel.confirm_rewrite"),
		discardRewrite: t("diary_panel.discard_rewrite"),
		pendingRewriteLabel: t("diary_panel.pending_rewrite_label"),
	};

	const diaryUiText = {
		generate: t("diary_panel.generate"),
		regenerate: t("diary_panel.regenerate"),
		generating: t("diary_panel.generating"),
		generateTitle: t("diary_panel.generate_title"),
		regenerateTitle: t("diary_panel.regenerate_title"),
	};

	useEffect(() => {
		setDiaryContent(currentEntry?.diary || "");
		setMemoContent(currentEntry?.notes || currentEntry?.memo || "");
		setIsEditingDiary(false);
		setIsEditingMemo(false);
	}, [selectedDate, currentEntry?.diary, currentEntry?.notes, currentEntry?.memo]);

	const isAuthenticated = skipPinCheck || !pinRequired || isPinAuthenticated;
	// 암호화 키가 잠겨 있으면 일기 내용/편집 UI 대신 패스프레이즈 입력을 보여준다
	const isEncLocked = encryptionStatus === "locked";

	useEffect(() => {
		if (skipPinCheck) return;
		refreshPinAuthState?.();
	}, [skipPinCheck, pinLockMode, refreshPinAuthState]);

	useEffect(() => {
		if (skipPinCheck) return;
		return () => {
			if (pinRequired && pinLockMode === "immediate" && isAuthenticated) {
				clearPinSession();
			}
		};
	}, [skipPinCheck, pinRequired, pinLockMode, isAuthenticated, clearPinSession]);

	useEffect(() => {
		if (
			skipPinCheck ||
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
		skipPinCheck,
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
				) : isEncLocked ? (
						<div className={`rounded-lg px-3 py-3 ${secondaryBgCls}`}>
							<DiaryUnlock />
						</div>
					) : (
						<div
							className={`h-12 rounded-lg px-3 flex items-center gap-3 ${secondaryBgCls}`}
					>
						<p
							className={`text-[11px] whitespace-nowrap ${isDark ? "text-gray-400" : "text-gray-500"}`}
							style={bodyStyle}
						>
							{formatDate(selectedDate)}
						</p>
						<p
							className={`text-xs truncate ${isDark ? "text-gray-300" : "text-gray-700"}`}
							style={bodyStyle}
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

			{isAuthenticated && isEncLocked && (
					<div className={`rounded-lg px-4 py-4 ${secondaryBgCls}`}>
						<DiaryUnlock />
					</div>
				)}

				{isAuthenticated && !isEncLocked && (
					<div className="space-y-4">
					<p
						className={`text-xs font-medium flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}
						style={bodyStyle}
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
								style={bodyStyle}
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
									style={bodyStyle}
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
								style={bodyStyle}
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
									style={bodyStyle}
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
								<span className={`text-xs font-medium ${isDark ? "opacity-70" : "text-gray-600"}`} style={bodyStyle}>
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
										title={t("diary_panel.like")}
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
										title={t("diary_panel.dislike")}
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
										style={bodyStyle}
										placeholder={copy.feedbackPlaceholder}
									/>
									<button
										onClick={handleRewrite}
										disabled={!feedbackText.trim() || isRewriting}
										className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-blue-500/60"
									>
										<RefreshCw size={13} className={isRewriting ? "animate-spin" : ""} />
										{isRewriting ? copy.rewriting : copy.rewrite}
									</button>
								</div>
							)}

							{/* pendingRewrite 미리보기 */}
							{currentEntry?.feedback?.pendingRewrite && (
								<div className="space-y-2">
									<p className={`text-xs font-medium ${isDark ? "opacity-70" : "text-gray-600"}`} style={bodyStyle}>
										{copy.pendingRewriteLabel}
									</p>
									<div className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${secondaryBgCls} border border-blue-500/30`} style={bodyStyle}>
										{currentEntry.feedback.pendingRewrite}
									</div>
									<div className="flex gap-2">
										<button
											onClick={handleConfirmRewrite}
											className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1"
										>
											<CheckCircle size={13} />
											{copy.confirmRewrite}
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
										style={bodyStyle}
										placeholder={copy.feedbackPlaceholder}
									/>
									<button
										onClick={handleRewrite}
										disabled={!feedbackText.trim() || isRewriting}
										className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${secondaryBgCls} ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} disabled:opacity-40 disabled:cursor-not-allowed`}
									>
										<RefreshCw size={13} className={isRewriting ? "animate-spin" : ""} />
										{isRewriting ? copy.rewriting : copy.rewrite}
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			)}


		</div>
	);
};

export default DiaryPanel;
