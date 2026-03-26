import { useState, useEffect, useMemo } from "react";
import { X, Search, Lock, BookOpen, ChevronRight, ChevronLeft, Edit2, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import PINModal from "./PINModal";

/**
 * DiaryListModal — PIN-protected list of all historical diary entries
 * PHASE 11 REFINEMENT: Added Detail/Edit modal view with navigation
 * - Click diary entry to open detail modal
 * - Edit mode within detail modal
 * - Back button returns to list
 * - Save functionality for edits
 * @param {{ onClose: () => void }} props
 */
const DiaryListModal = ({ onClose }) => {
	const { isDark, cardCls, inputCls } = useTheme();
	const { entries, getDiaryDates, isPinAuthenticatedSession, saveDiary, saveMemo } = useDiaryStore();

	const [showPinModal, setShowPinModal] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [sortBy, setSortBy] = useState("recent"); // 'recent' or 'oldest'
	
	/* PHASE 11: Detail modal & edit view state */
	const [detailDateStr, setDetailDateStr] = useState(null);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editDiary, setEditDiary] = useState("");
	const [editMemo, setEditMemo] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	/* Check if PIN is authenticated */
	const isAuthenticated = isPinAuthenticatedSession?.();

	/* Show PIN modal if not authenticated */
	useEffect(() => {
		if (!isAuthenticated && !showPinModal) {
			setShowPinModal(true);
		}
	}, [isAuthenticated, showPinModal]);

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
			const memo = entry?.memo || "";
			return (
				dateStr.includes(query) ||
				diary.toLowerCase().includes(query) ||
				memo.toLowerCase().includes(query)
			);
		});

		// Sort
		filtered.sort((a, b) => {
			const dateA = new Date(a);
			const dateB = new Date(b);
			return sortBy === "recent" ? dateB - dateA : dateA - dateB;
		});

		return filtered;
	}, [diaryDates, searchQuery, sortBy, entries]);

	/* Format date for display */
	const formatDate = (dateStr) => {
		const d = new Date(dateStr + "T00:00:00");
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${days[d.getDay()]}`;
	};

	/* Format preview text (first 100 chars) */
	const formatPreview = (text, maxLength = 100) => {
		if (!text) return "";
		return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
	};

	/* PHASE 11: Open detail view for a diary entry */
	const handleOpenDetail = (dateStr) => {
		setDetailDateStr(dateStr);
		const entry = entries[dateStr];
		setEditDiary(entry?.diary || "");
		setEditMemo(entry?.memo || "");
		setIsEditMode(false);
	};

	/* PHASE 11: Back to list */
	const handleBackToList = () => {
		setDetailDateStr(null);
		setIsEditMode(false);
		setEditDiary("");
		setEditMemo("");
	};

	/* PHASE 11: Save edits */
	const handleSaveEdits = async () => {
		setIsSaving(true);
		try {
			if (editDiary !== (entries[detailDateStr]?.diary || "")) {
				await saveDiary(detailDateStr, editDiary);
			}
			if (editMemo !== (entries[detailDateStr]?.memo || "")) {
				await saveMemo(detailDateStr, editMemo);
			}
			setIsEditMode(false);
		} catch (err) {
			console.error("Failed to save diary:", err);
		}
		setIsSaving(false);
	};

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
						className={`relative z-10 w-full max-w-2xl max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${cardCls}`}
						onClick={(e) => e.stopPropagation()}
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{ duration: 0.2 }}
					>
						{/* Header */}
						<div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-[#3a3a3a]" : "border-gray-200"}`}>
							<div className="flex items-center gap-3">
								<div className={`p-2 rounded-lg ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}>
									<BookOpen size={18} className="text-blue-500" />
								</div>
								<div>
									<h2 className="font-bold text-lg">Diary List</h2>
									{diaryDates.length > 0 && (
										<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											{diaryDates.length} entries found
										</p>
									)}
								</div>
							</div>
							<button
								onClick={onClose}
								className={`p-1 rounded-full transition-colors ${
									isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
								}`}
							>
								<X size={18} />
							</button>
						</div>

						{/* PIN Modal */}
						{showPinModal && !isAuthenticated && (
							<PINModal
								onSuccess={() => setShowPinModal(false)}
								onCancel={onClose}
							/>
						)}

						{/* Locked State */}
						{!isAuthenticated && !showPinModal && (
							<div className="flex flex-col items-center justify-center py-16 opacity-50">
								<Lock size={40} className="mb-3" />
								<p className="text-sm text-center">Diary list is protected</p>
								<button
									onClick={() => setShowPinModal(true)}
									className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
										isDark ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"
									}`}
								>
									Unlock
								</button>
							</div>
						)}

						{/* Unlocked Content */}
						{isAuthenticated && (
							<>
								{/* Search & Sort Controls */}
								<div className={`p-4 border-b space-y-3 ${isDark ? "border-[#3a3a3a] bg-[#2a2a2a]" : "border-gray-200 bg-gray-50"}`}>
									{/* Search */}
									<div className="relative">
										<Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-50" />
										<input
											type="text"
											placeholder="Search by date or content..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 ${inputCls}`}
										/>
									</div>

									{/* Sort */}
									<div className="flex items-center gap-2">
										<label className={`text-xs font-medium ${isDark ? "opacity-70" : "text-gray-600"}`}>
											Sort:
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
															: isDark
															? "bg-[#3a3a3a] text-gray-400 hover:bg-[#454545]"
															: "bg-gray-200 text-gray-600 hover:bg-gray-300"
													}`}
												>
													{option === "recent" ? "Most Recent" : "Oldest"}
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
												const preview = formatPreview(entry?.diary || entry?.memo || "");

												return (
													<button
														key={dateStr}
														onClick={() => handleOpenDetail(dateStr)}
														className={`w-full text-left p-4 transition-all ${
															isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
														}`}
													>
														{/* Entry Header */}
														<div className="flex items-start justify-between gap-3">
															<div className="flex-1 min-w-0">
																<h4 className="font-semibold text-sm">{formatDate(dateStr)}</h4>
																<p className={`text-xs mt-1 line-clamp-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
																	{preview || "(No content)"}
																</p>
															</div>
															<ChevronRight size={16} className="flex-shrink-0" />
														</div>
													</button>
												);
											})}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center py-12 opacity-50">
											<BookOpen size={32} className="mb-2" />
											<p className="text-sm">
												{diaryDates.length === 0 ? "No diary entries yet" : "No entries match your search"}
											</p>
										</div>
									)}
								</div>
							</>
						)}
					</motion.div>
				) : null}
			</AnimatePresence>

			{/* Modal Content - Detail/Edit View */}
			<AnimatePresence mode="wait">
			{detailDateStr ? (
					<motion.div
						key="detail-view"
						className={`relative z-10 w-full max-w-2xl max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${cardCls}`}
						onClick={(e) => e.stopPropagation()}
						initial={{ opacity: 0, scale: 0.95, x: 50 }}
						animate={{ opacity: 1, scale: 1, x: 0 }}
						exit={{ opacity: 0, scale: 0.95, x: -50 }}
						transition={{ duration: 0.2 }}
					>
						{/* Detail Header */}
						<div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-[#3a3a3a]" : "border-gray-200"}`}>
							<div className="flex items-center gap-3">
								<button
									onClick={handleBackToList}
									className={`p-1 rounded-full transition-colors ${
										isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
									}`}
									title="Back to list"
								>
									<ChevronLeft size={18} />
								</button>
								<div>
									<h2 className="font-bold text-lg">{formatDate(detailDateStr)}</h2>
									<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
										{isEditMode ? "Editing..." : "Detail View"}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{isEditMode ? (
									<>
										<button
											onClick={handleSaveEdits}
											disabled={isSaving}
											className={`p-1 rounded-full transition-colors ${
												isSaving ? "opacity-50 cursor-not-allowed" : isDark ? "hover:bg-green-500/20" : "hover:bg-green-100"
											}`}
											title="Save"
										>
											<Save size={18} className={isSaving ? "" : "text-green-500"} />
										</button>
										<button
											onClick={() => {
												setIsEditMode(false);
												const entry = entries[detailDateStr];
												setEditDiary(entry?.diary || "");
												setEditMemo(entry?.memo || "");
											}}
											className={`p-1 rounded-full transition-colors ${
												isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
											}`}
											title="Cancel"
										>
											<X size={18} />
										</button>
									</>
								) : (
									<>
										<button
											onClick={() => setIsEditMode(true)}
											className={`p-1 rounded-full transition-colors ${
												isDark ? "hover:bg-blue-500/20" : "hover:bg-blue-100"
											}`}
											title="Edit"
										>
											<Edit2 size={18} className="text-blue-500" />
										</button>
										<button
									onClick={onClose}
									className={`p-1 rounded-full transition-colors ${
										isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
									}`}
									title="Close entire modal"									>											<X size={18} />
										</button>
									</>
								)}
							</div>
						</div>

						{/* Detail Content */}
						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{isEditMode ? (
								/* Edit Mode */
								<>
									<div className="space-y-2">
										<label className={`text-xs font-semibold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
											Diary
										</label>
										<textarea
											value={editDiary}
											onChange={(e) => setEditDiary(e.target.value)}
											placeholder="Write your diary entry..."
											className={`w-full h-32 px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
										/>
									</div>
									<div className="space-y-2">
										<label className={`text-xs font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}>
											Notes
										</label>
										<textarea
											value={editMemo}
											onChange={(e) => setEditMemo(e.target.value)}
											placeholder="Add notes or reflections..."
											className={`w-full h-24 px-3 py-2 rounded-lg text-sm outline-none border transition-all focus:ring-2 focus:ring-green-500/30 resize-none ${inputCls}`}
										/>
									</div>
								</>
							) : (
								/* View Mode */
								<>
									{editDiary && (
										<div className="space-y-2">
											<div className={`text-xs font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>
												Diary
											</div>
											<p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? "text-gray-300" : "text-gray-700"}`}>
												{editDiary}
											</p>
										</div>
									)}
									{editMemo && (
										<div className="space-y-2">
											<div className={`text-xs font-semibold ${isDark ? "text-green-300" : "text-green-600"}`}>
												Notes
											</div>
											<p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? "text-gray-300" : "text-gray-700"}`}>
												{editMemo}
											</p>
										</div>
									)}
									{!editDiary && !editMemo && (
										<div className={`text-sm text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}>
											No content for this date
										</div>
									)}
								</>
							)}
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
};

export default DiaryListModal;
