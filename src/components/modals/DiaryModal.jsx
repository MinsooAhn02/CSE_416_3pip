import { useState, useEffect } from "react";
import { X, BookOpen, Save } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";

/**
 * DiaryModal — 날짜별 일기 확인 + 메모 작성 모달
 * @param {{ dateStr: string, onClose: () => void }} props
 */
const DiaryModal = ({ dateStr, onClose }) => {
	const { isDark } = useTheme();
	const getDiary = useDiaryStore((s) => s.getDiary);
	const saveMemo = useDiaryStore((s) => s.saveMemo);

	const entry = getDiary(dateStr);
	const diaryText = entry?.diary || "";
	const [memoText, setMemoText] = useState(entry?.memo || "");
	const [saving, setSaving] = useState(false);

	/* 날짜 포맷팅 (예: "2026년 3월 18일 수요일") */
	const dateLabel = (() => {
		const d = new Date(dateStr + "T00:00:00");
		const days = ["일", "월", "화", "수", "목", "금", "토"];
		return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
	})();

	/* 메모 저장 */
	const handleSaveMemo = async () => {
		setSaving(true);
		await saveMemo(dateStr, memoText.trim());
		setSaving(false);
	};

	return (
		/* 반투명 오버레이 */
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center p-4"
			onClick={onClose}
		>
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

			{/* 모달 본체 */}
			<div
				className={`relative z-10 w-full max-w-md max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
					isDark
						? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
						: "bg-white border-gray-200 text-slate-800"
				}`}
				onClick={(e) => e.stopPropagation()}
			>
				{/* 헤더 */}
				<div className="flex items-center justify-between p-4 border-b border-inherit">
					<div className="flex items-center gap-2">
						<BookOpen size={18} className="text-blue-500" />
						<h3 className="font-bold text-sm">{dateLabel}</h3>
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

				{/* 일기 본문 (읽기 모드) */}
				<div className="flex-1 overflow-y-auto p-4 diary-scroll">
					{diaryText ? (
						<div className="space-y-2">
							<p className={`text-xs font-medium ${isDark ? "text-blue-300" : "text-blue-600"}`}>
								AI 생성 일기
							</p>
							<p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? "opacity-90" : "text-slate-700"}`}>
								{diaryText}
							</p>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-8 opacity-50">
							<BookOpen size={32} className="mb-2" />
							<p className="text-sm">일기가 아직 생성되지 않았습니다.</p>
						</div>
					)}
				</div>

				{/* 메모 입력 영역 */}
				<div className={`p-4 border-t ${isDark ? "border-[#3a3a3a]" : "border-gray-200"}`}>
					<p className={`text-xs font-medium mb-2 ${isDark ? "opacity-60" : "text-gray-500"}`}>
						작은 메모
					</p>
					<textarea
						value={memoText}
						onChange={(e) => setMemoText(e.target.value)}
						placeholder="이 날에 대한 메모를 남겨보세요..."
						rows={3}
						className={`w-full rounded-lg p-3 text-xs resize-none outline-none border focus:ring-2 focus:ring-blue-500/30 transition-all ${
							isDark
								? "bg-[#2a2a2a] border-[#3a3a3a] text-white placeholder:text-neutral-500"
								: "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-gray-400"
						}`}
					/>
					<button
						onClick={handleSaveMemo}
						disabled={saving}
						className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
					>
						<Save size={12} />
						{saving ? "저장 중..." : "메모 저장"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default DiaryModal;
