import { useState, useEffect, useMemo } from "react";
import {
	X,
	Search,
	BookOpen,
	ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useFontSize } from "../../hooks/useFontSize";
import { useShallow } from "zustand/react/shallow";
import { useDialog } from "../../hooks/useDialog";
import { useDiaryStore } from "../../store/useDiaryStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import PINModal from "./PINModal";
import DiaryPanel from "../layout/DiaryPanel";
import DiaryUnlock from "../common/DiaryUnlock";

/**
 * DiaryListModal — PIN-protected list of all historical diary entries
 * PHASE 11 REFINEMENT: Added Detail/Edit modal view with navigation
 * - Click diary entry to open detail modal
 * - Edit mode within detail modal
 * - Back button returns to list
 * - Save functionality for edits
 * @param {{ onClose: () => void }} props
 */
interface DiaryListModalProps {
	onClose: () => void;
}

const DiaryListModal = ({ onClose }: DiaryListModalProps) => {
	const { t } = useTranslation();
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls, borderCls } =
		useTheme();
	const { body: bodyStyle } = useFontSize();
	const {
		entries,
		getDiaryDates,
		pinSet,
		isPinAuthenticated,
		pinAuthExpiresAt,
		refreshPinAuthState,
		clearPinSession,
		encryptionStatus,
	} = useDiaryStore(
		useShallow((s) => ({
			entries: s.entries,
			getDiaryDates: s.getDiaryDates,
			pinSet: s.pinSet,
			isPinAuthenticated: s.isPinAuthenticated,
			pinAuthExpiresAt: s.pinAuthExpiresAt,
			refreshPinAuthState: s.refreshPinAuthState,
			clearPinSession: s.clearPinSession,
			encryptionStatus: s.encryptionStatus,
		})),
	);
	const pinLockMode = useSettingsStore((state) => state.pinLockMode);
	const pinRequired = pinSet && pinLockMode !== "off";

	const [showPinModal, setShowPinModal] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState("recent"); // 'recent' or 'oldest'
	const [detailDateStr, setDetailDateStr] = useState<string | null>(null);

	/* Check if PIN is authenticated */
	const isAuthenticated = !pinRequired || isPinAuthenticated;

	// 상세 보기에서는 Escape가 목록으로, 목록에서는 모달 닫기. PIN 화면은 PINModal이 처리
	const { ref: dialogRef, dialogProps } = useDialog<HTMLDivElement>({
		open: isAuthenticated,
		onClose: () => (detailDateStr ? setDetailDateStr(null) : onClose()),
		labelledBy: "diary-list-title",
	});

	useEffect(() => {
		refreshPinAuthState?.();
	}, [pinLockMode, refreshPinAuthState]);

	/* Show PIN modal if not authenticated */
	useEffect(() => {
		if (!pinRequired) {
			setShowPinModal(false);
			return;
		}

		if (!isAuthenticated && !showPinModal) {
			setShowPinModal(true);
		}
	}, [pinRequired, isAuthenticated, showPinModal]);

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

	useEffect(() => {
		return () => {
			if (pinRequired && pinLockMode === "immediate" && isAuthenticated) {
				clearPinSession();
			}
		};
	}, [pinRequired, pinLockMode, isAuthenticated, clearPinSession]);

	/* Get all diary dates */
	const diaryDates = useMemo(() => {
		return getDiaryDates?.() || [];
	}, [getDiaryDates]);

	/* Filter and sort entries */
	const filteredAndSorted = useMemo(() => {
		const query = searchQuery.toLowerCase();

		let filtered = diaryDates.filter((dateStr) => {
			const entry = entries[dateStr];
			const diary = entry?.diary || "";
			const memo = entry?.notes || entry?.memo || "";
			return (
				dateStr.includes(query) ||
				diary.toLowerCase().includes(query) ||
				memo.toLowerCase().includes(query)
			);
		});

		// Sort
		filtered.sort((a, b) => {
			const dateA = new Date(a).getTime();
			const dateB = new Date(b).getTime();
			return sortBy === "recent" ? dateB - dateA : dateA - dateB;
		});

		return filtered;
	}, [diaryDates, searchQuery, sortBy, entries]);

	/* Format date for display */
	const formatDate = (dateStr: string) => {
		const d = new Date(dateStr + "T00:00:00");
		const days = t("calendar.days", { returnObjects: true }) as string[];
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${days[d.getDay()]}`;
	};

	/* Format preview text (first 100 chars) */
	const formatPreview = (text: string, maxLength = 100) => {
		if (!text) return "";
		return text.length > maxLength
			? text.substring(0, maxLength) + "..."
			: text;
	};

	const handleOpenDetail = (dateStr: string) => {
		setDetailDateStr(dateStr);
	};

	const handleBackToList = () => {
		setDetailDateStr(null);
	};

	if (pinRequired && !isAuthenticated) {
		if (!showPinModal) return null;
		return (
			<PINModal
				mode={pinSet ? "verify" : "setup"}
				onSuccess={() => setShowPinModal(false)}
				onCancel={onClose}
			/>
		);
	}

	return (
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center p-4"
			onClick={onClose}
		>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

			{/* Modal Content - List View */}
			<AnimatePresence mode="wait">
				{!detailDateStr ? (
					<motion.div
						key="list-view"
						ref={dialogRef}
						{...dialogProps}
						className={`relative z-10 w-full max-w-2xl max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${cardCls}`}
						onClick={(e) => e.stopPropagation()}
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{ duration: 0.2 }}
					>
						{/* Header */}
						<div
							className={`flex items-center justify-between p-4 border-b ${borderCls}`}
						>
							<div className="flex items-center gap-3">
								<div
									className={`p-2 rounded-lg ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}
								>
									<BookOpen size={18} className="text-blue-500" />
								</div>
								<div>
									<h2 id="diary-list-title" className="font-bold text-lg">{t("diary.diary_list")}</h2>
									{diaryDates.length > 0 && (
										<p
											className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
										>
											{t("diary.entries_found", { count: diaryDates.length })}
										</p>
									)}
								</div>
							</div>
							<button
								onClick={onClose}
								aria-label={t("common.close")}
								className={`p-1 rounded-full transition-colors ${hoverCls}`}
							>
								<X size={18} />
							</button>
						</div>

						{/* Unlocked Content */}
						{isAuthenticated && encryptionStatus === "locked" && (
								<div className="p-6">
									<DiaryUnlock />
								</div>
							)}

							{isAuthenticated && encryptionStatus !== "locked" && (
								<>
								{/* Search & Sort Controls */}
								<div
									className={`p-4 border-b space-y-3 ${`${borderCls} ${secondaryBgCls}`}`}
								>
									{/* Search */}
									<div className="relative">
										<Search
											size={16}
											className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-50"
										/>
										<input
											type="text"
											placeholder={t("diary_panel.list_search_placeholder")}
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 ${inputCls}`}
										/>
									</div>

									{/* Sort */}
									<div className="flex items-center gap-2">
										<label
											className={`text-xs font-medium ${isDark ? "opacity-70" : "text-gray-600"}`}
										>
											{t("diary.sort_label")}
										</label>
										<div className="flex gap-2">
											{["recent", "oldest"].map((option) => (
												<button
													key={option}
													onClick={() => setSortBy(option)}
													className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
														sortBy === option
															? isDark
																? "bg-blue-600 text-white"
																: "bg-blue-500 text-white"
															: `${secondaryBgCls} ${hoverCls}`
													}`}
												>
													{option === "recent" ? t("diary.sort_recent") : t("diary.sort_oldest")}
												</button>
											))}
										</div>
									</div>
								</div>

								{/* Entries List or Empty State */}
								<div className="flex-1 overflow-y-auto">
									{filteredAndSorted.length > 0 ? (
										<div className="divide-y divide-current divide-opacity-10">
											{filteredAndSorted.map((dateStr) => {
												const entry = entries[dateStr];
												const preview = formatPreview(
													entry?.diary || entry?.notes || entry?.memo || "",
												);

												return (
													<button
														key={dateStr}
														onClick={() => handleOpenDetail(dateStr)}
														className={`w-full text-left p-4 transition-all ${
															hoverCls
														}`}
													>
														{/* Entry Header */}
														<div className="flex items-start justify-between gap-3">
															<div className="flex-1 min-w-0">
																<h4 className="font-semibold text-sm" style={bodyStyle}>
																	{formatDate(dateStr)}
																</h4>
																<p
																	className={`text-xs mt-1 line-clamp-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
																	style={bodyStyle}
																>
																	{preview || "(No content)"}
																</p>
															</div>
															<ChevronRight
																size={16}
																className="flex-shrink-0"
															/>
														</div>
													</button>
												);
											})}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center py-12 opacity-50">
											<BookOpen size={32} className="mb-2" />
											<p className="text-sm">
												{diaryDates.length === 0
													? "No diary entries yet"
													: "No entries match your search"}
											</p>
										</div>
									)}
								</div>
							</>
						)}
					</motion.div>
				) : null}
			</AnimatePresence>

			{/* Modal Content - Detail View (DiaryPanel) */}
			<AnimatePresence mode="wait">
				{detailDateStr ? (
					<motion.div
						key="detail-view"
						ref={dialogRef}
						{...dialogProps}
						aria-labelledby={undefined}
						className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar"
						onClick={(e) => e.stopPropagation()}
						initial={{ opacity: 0, scale: 0.95, x: 50 }}
						animate={{ opacity: 1, scale: 1, x: 0 }}
						exit={{ opacity: 0, scale: 0.95, x: -50 }}
						transition={{ duration: 0.2 }}
					>
						<DiaryPanel selectedDate={detailDateStr} onClose={handleBackToList} skipPinCheck={true} />
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
};

export default DiaryListModal;
