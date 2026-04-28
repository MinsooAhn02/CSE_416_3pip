import { useEffect, useMemo, useState } from "react";
import { BookOpen, Lock, Edit2, RotateCcw, Save, Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { generateAndSaveDiaryForDate } from "../../services/diaryGenerationService";
import PINModal from "../modals/PINModal";

const DiaryPanel = ({ selectedDate, onClose, compact = false }) => {
	const { i18n } = useTranslation();
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls } = useTheme();
	const {
		getDiary,
		saveDiary,
		saveMemo,
		revertDiaryToGenerated,
		pinSet,
		isPinAuthenticated,
		pinAuthExpiresAt,
		refreshPinAuthState,
		clearPinSession,
	} = useDiaryStore();
	const pinLockMode = useSettingsStore((state) => state.pinLockMode);
	const setShowSettings = useSettingsStore((state) => state.setShowSettings);
	const setSettingsTab = useSettingsStore((state) => state.setSettingsTab);
	const pinRequired = pinSet && pinLockMode !== "off";

	const currentEntry = getDiary(selectedDate);
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
			await saveDiary(selectedDate, diaryContent.trim());
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
			await revertDiaryToGenerated(selectedDate);
			setDiaryContent(aiGeneratedDiary);
			setIsEditingDiary(false);
		} catch (err) {
			console.error("Failed to revert diary:", err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleSaveMemo = async () => {
		setIsSaving(true);
		try {
			await saveMemo(selectedDate, memoContent.trim());
			setIsEditingMemo(false);
		} catch (err) {
			console.error("Failed to save memo:", err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleGenerateDiary = async (overwrite = false) => {
		setIsGeneratingDiary(true);
		try {
			await generateAndSaveDiaryForDate(selectedDate, { overwrite });
			setIsEditingDiary(false);
		} catch (err) {
			console.error("Failed to generate diary:", err);
		} finally {
			setIsGeneratingDiary(false);
		}
	};

	const handleLock = () => {
		clearPinSession();
	};

	const handleOpenDiarySettings = () => {
		setSettingsTab("diary");
		setShowSettings(true);
	};

	const formatDate = (dateStr) => {
		const d = new Date(`${dateStr}T00:00:00`);
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${days[d.getDay()]}`;
	};

	if (compact) {
		const previewText =
			diaryContent || memoContent || "No diary content for this date.";

		return (
			<div className={`rounded-xl border p-3 ${cardCls}`}>
				<div className="flex items-center justify-between gap-2 mb-2">
					<div className="flex items-center gap-2">
						<BookOpen size={15} className="text-blue-500" />
						<h3 className="font-bold text-xs">Diary</h3>
						{pinRequired && !isAuthenticated && (
							<Lock size={13} className="text-gray-500" />
						)}
					</div>
					<div className="flex items-center gap-1">
						{pinRequired && isAuthenticated && (
							<button
								onClick={handleLock}
								title="Lock diary"
								className={`p-1 rounded-md transition-colors ${hoverCls}`}
							>
								<Lock size={14} />
							</button>
						)}
						{pinSet && (
							<button
								onClick={handleOpenDiarySettings}
								title="Diary settings"
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
									? "Diary is locked."
									: "Diary PIN is required before opening this diary."}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setShowPinModal(true)}
							className="w-full rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
						>
							{pinSet ? "Unlock" : "Set up PIN"}
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
					<h3 className="font-bold text-sm">Diary</h3>
					{pinRequired && !isAuthenticated && (
						<Lock size={14} className="text-gray-500" />
					)}
				</div>
				<div className="flex items-center gap-1">
					{pinRequired && isAuthenticated && (
						<button
							onClick={handleLock}
							title="Lock diary"
							className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
						>
							<Lock size={16} />
						</button>
					)}
					{pinSet && (
						<button
							onClick={handleOpenDiarySettings}
							title="Diary settings"
							className={`p-1.5 rounded-lg transition-colors ${hoverCls}`}
						>
							<Settings size={16} />
						</button>
					)}
					{onClose && (
						<button
							onClick={onClose}
							title="Close diary"
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
							? "This diary is locked."
							: "PIN setup is required before opening the diary."}
					</p>
					<button
						type="button"
						onClick={() => setShowPinModal(true)}
						className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
					>
						{pinSet ? "Unlock" : "Set up PIN"}
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
								AI Generated Diary
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
										title="Revert to original AI diary"
									>
										<RotateCcw size={13} />
										Revert
									</button>
								)}
								{canEditDiary && !isEditingDiary && (
									<button
										onClick={() => setIsEditingDiary(true)}
										className={`p-1 rounded-lg text-xs transition-colors ${hoverCls}`}
										title="Edit diary"
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
								{diaryContent || "No AI diary generated for this date yet."}
							</div>
						) : (
							<div className="space-y-2">
								<textarea
									value={diaryContent}
									onChange={(e) => setDiaryContent(e.target.value)}
									rows={4}
									className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
									placeholder="Edit diary content..."
								/>
								<div className="flex gap-2">
									<button
										onClick={handleSaveDiary}
										disabled={isSaving}
										className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
									>
										<Save size={14} />
										{isSaving ? "Saving..." : "Save"}
									</button>
									<button
										onClick={() => {
											setDiaryContent(currentEntry?.diary || "");
											setIsEditingDiary(false);
										}}
										className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${`${secondaryBgCls} ${hoverCls}`}`}
									>
										Cancel
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
								Memo
							</label>
							{!isEditingMemo && (
								<button
									onClick={() => setIsEditingMemo(true)}
									className={`p-1 rounded-lg text-xs transition-colors ${hoverCls}`}
									title="Edit Memo"
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
								{memoContent || "Click to add memo..."}
							</div>
						) : (
							<div className="space-y-2">
								<textarea
									value={memoContent}
									onChange={(e) => setMemoContent(e.target.value)}
									rows={4}
									className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
									placeholder="Write your memo here..."
								/>
								<div className="flex gap-2">
									<button
										onClick={handleSaveMemo}
										disabled={isSaving}
										className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
									>
										<Save size={14} />
										{isSaving ? "Saving..." : "Save"}
									</button>
									<button
										onClick={() => {
											setMemoContent(currentEntry?.notes || currentEntry?.memo || "");
											setIsEditingMemo(false);
										}}
										className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${`${secondaryBgCls} ${hoverCls}`}`}
									>
										Cancel
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default DiaryPanel;
