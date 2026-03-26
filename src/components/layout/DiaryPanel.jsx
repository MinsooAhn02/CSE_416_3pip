import { useState, useEffect } from "react";
import { BookOpen, Lock, Edit2, Save, X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import PINModal from "../modals/PINModal";

/**
 * DiaryPanel — PIN-protected diary display and edit
 * 
 * BUG FIX #1: Blur-Lock Interaction
 * - Shows blurred content with lock overlay initially
 * - PIN modal only appears on user click, not automatically
 * 
 * BUG FIX #2: Strict PIN Session Reset
 * - PIN auth resets when closing/switching dates
 * - User must re-enter PIN every time
 * 
 * BUG FIX #4: Diary Edit Functionality
 * - Users can now edit AI-generated diary content
 * - Save button updates state correctly
 * 
 * @param {{ selectedDate: string, onClose?: () => void }} props
 */
const DiaryPanel = ({ selectedDate, onClose }) => {
	const { isDark, cardCls, inputCls } = useTheme();
	const { getDiary, saveDiary, saveMemo, isPinAuthenticatedSession, clearPinSession } = useDiaryStore();

	const [showPinModal, setShowPinModal] = useState(false);
	const [isEditingDiary, setIsEditingDiary] = useState(false);
	const [isEditingMemo, setIsEditingMemo] = useState(false);
	const [diaryContent, setDiaryContent] = useState("");
	const [memoContent, setMemoContent] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	/* Load diary data on mount */
	useEffect(() => {
		const entry = getDiary(selectedDate);
		if (entry) {
			setDiaryContent(entry.diary || "");
			setMemoContent(entry.memo || "");
		}
		// Reset editing states when date changes
		setIsEditingDiary(false);
		setIsEditingMemo(false);
	}, [selectedDate, getDiary]);

	/* Check if PIN is authenticated */
	const isAuthenticated = isPinAuthenticatedSession?.();

	/* BUG FIX #2: Reset PIN session when closing or switching dates */
	useEffect(() => {
		return () => {
			// Cleanup: Reset PIN auth when component unmounts or date changes
			if (isAuthenticated) {
				clearPinSession();
			}
		};
	}, [selectedDate, isAuthenticated, clearPinSession]);

	/* Handle diary save (BUG FIX #4: Edit Diary functionality) */
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

	/* Handle memo save */
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

	/* Handle lock button - reset PIN only, don't close panel (BUG FIX #2) */
	const handleLock = () => {
		// BUG FIX #2: Only reset PIN session, NOT the entire panel
		// This ensures the diary locks while keeping the Date Details view open
		clearPinSession();
		// Do NOT call onClose() - that would close the entire panel
	};

	/* Format date for display */
	const formatDate = (dateStr) => {
		const d = new Date(dateStr + "T00:00:00");
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${days[d.getDay()]}`;
	};

	return (
		<div className={`rounded-xl border p-4 space-y-4 h-auto ${cardCls}`}>
			{/* Header */}
			<div className="flex items-center justify-between gap-2 mb-4">
				<div className="flex items-center gap-2">
					<BookOpen size={16} className="text-blue-500" />
					<h3 className="font-bold text-sm">Diary</h3>
					{!isAuthenticated && <Lock size={14} className="text-gray-500" />}
				</div>
				{isAuthenticated && (
					<button
						onClick={handleLock}
						title="Lock and reset PIN"
						className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
					>
						<Lock size={16} />
					</button>
				)}
			</div>

			{/* PIN Modal (BUG FIX #1: Only shows on click, not automatically) */}
			{showPinModal && !isAuthenticated && (
				<PINModal
					onSuccess={() => {
						setShowPinModal(false);
					}}
					onCancel={() => {
						setShowPinModal(false);
						onClose?.();
					}}
				/>
			)}

			{/* BUG FIX #4: Clean Lock UI - Solid background with lock icon (no blur) */}
			{!isAuthenticated && (
				<div
					onClick={() => setShowPinModal(true)}
					className={`h-[280px] rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
						isDark
							? "bg-[#2a2a2a] hover:bg-[#353535]"
							: "bg-gray-50 hover:bg-gray-100"
					}`}
				>
					<Lock size={48} className={`mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
					<p className={`text-xs font-medium text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}>
						Click to unlock
					</p>
				</div>
			)}

			{/* BUG FIX #4: Unlocked Content with Editable Diary */}
			{isAuthenticated && (
				<div className="space-y-4">
					{/* Date Info */}
					<p className={`text-xs font-medium flex-shrink-0 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
						{formatDate(selectedDate)}
					</p>

					{/* AI Generated Diary (Now Editable!) */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className={`text-xs font-medium block ${isDark ? "text-blue-300" : "text-blue-600"}`}>
								AI Generated Diary
							</label>
							{!isEditingDiary && (
								<button
									onClick={() => setIsEditingDiary(true)}
									className={`p-1 rounded-lg text-xs transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
									title="Edit diary"
								>
									<Edit2 size={14} />
								</button>
							)}
						</div>
						{!isEditingDiary ? (
							<div
								className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap min-h-[80px] cursor-pointer transition-all ${
									isDark ? "bg-[#2a2a2a] text-gray-300 hover:bg-[#353535]" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
								}`}
								onClick={() => setIsEditingDiary(true)}
							>
								{diaryContent || "No diary generated for this date yet."}
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
										onClick={() => setIsEditingDiary(false)}
										className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? "bg-[#2a2a2a] hover:bg-[#353535]" : "bg-gray-100 hover:bg-gray-200"}`}
									>
										Cancel
									</button>
								</div>
							</div>
						)}
					</div>

					{/* Memo Section */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className={`text-xs font-medium block ${isDark ? "opacity-70" : "text-gray-600"}`}>
								Personal Notes
							</label>
							{!isEditingMemo && (
								<button
									onClick={() => setIsEditingMemo(true)}
									className={`p-1 rounded-lg text-xs transition-colors ${isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"}`}
									title="Edit notes"
								>
									<Edit2 size={14} />
								</button>
							)}
						</div>
						{!isEditingMemo ? (
							<div
								className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap min-h-[80px] cursor-pointer transition-all ${
									isDark ? "bg-[#2a2a2a] text-gray-400 hover:bg-[#353535]" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
								}`}
								onClick={() => setIsEditingMemo(true)}
							>
								{memoContent || "Click to add personal notes..."}
							</div>
						) : (
							<div className="space-y-2">
								<textarea
									value={memoContent}
									onChange={(e) => setMemoContent(e.target.value)}
									rows={4}
									className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 resize-none ${inputCls}`}
									placeholder="Write your personal notes here..."
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
										onClick={() => setIsEditingMemo(false)}
										className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? "bg-[#2a2a2a] hover:bg-[#353535]" : "bg-gray-100 hover:bg-gray-200"}`}
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
