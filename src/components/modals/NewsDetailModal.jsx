import { useState } from "react";
import { X, ExternalLink, ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

/**
 * 뉴스 상세 모달 — 요약 리스트 + 개별 클릭 시 content 확장 + 원문 링크
 * @param {{ results: Array, answer: string, onClose: () => void }} props
 */
const NewsDetailModal = ({ results = [], answer = "", onClose }) => {
	const { isDark } = useTheme();
	const [expandedIdx, setExpandedIdx] = useState(null);

	const toggleExpand = (idx) => {
		setExpandedIdx((prev) => (prev === idx ? null : idx));
	};

	return (
		/* 반투명 오버레이 */
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center p-4"
			onClick={onClose}
		>
			{/* 배경 블러 */}
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

			{/* 모달 본체 */}
			<div
				className={`relative z-10 w-full max-w-lg max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
					isDark
						? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
						: "bg-white border-gray-200 text-slate-800"
				}`}
				onClick={(e) => e.stopPropagation()}
			>
				{/* 헤더 */}
				<div className="flex items-center justify-between p-4 border-b border-inherit">
					<div className="flex items-center gap-2">
						<Newspaper size={18} className="text-blue-500" />
						<h3 className="font-bold text-sm">뉴스 상세</h3>
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

				{/* AI 전체 요약 */}
				{answer && (
					<div className={`px-4 py-3 border-b ${isDark ? "border-[#3a3a3a] bg-[#252525]" : "border-gray-100 bg-blue-50/30"}`}>
						<p className={`text-xs leading-relaxed ${isDark ? "text-blue-300" : "text-blue-700"}`}>
							{answer}
						</p>
					</div>
				)}

				{/* 뉴스 리스트 — 스크롤 영역 */}
				<div className="flex-1 overflow-y-auto p-4 space-y-2 diary-scroll">
					{results.length === 0 ? (
						<p className={`text-sm ${isDark ? "opacity-50" : "text-gray-400"}`}>
							표시할 뉴스가 없습니다.
						</p>
					) : (
						results.map((r, idx) => (
							<div
								key={idx}
								className={`rounded-xl border transition-colors ${
									isDark
										? "border-[#3a3a3a] hover:bg-[#2a2a2a]"
										: "border-gray-200 hover:bg-gray-50"
								}`}
							>
								{/* 뉴스 row — 클릭하면 content 토글 */}
								<button
									onClick={() => toggleExpand(idx)}
									className="w-full flex items-center justify-between gap-2 p-3 text-left"
								>
									<span className="text-xs font-medium flex-grow line-clamp-2">
										{r.title || "제목 없음"}
									</span>
									{expandedIdx === idx ? (
										<ChevronUp size={14} className="flex-shrink-0 opacity-50" />
									) : (
										<ChevronDown size={14} className="flex-shrink-0 opacity-50" />
									)}
								</button>

								{/* 확장 시 content + 원문 링크 */}
								{expandedIdx === idx && (
									<div className={`px-3 pb-3 space-y-2 border-t ${isDark ? "border-[#3a3a3a]" : "border-gray-100"}`}>
										<p className={`text-xs leading-relaxed pt-2 ${isDark ? "opacity-70" : "text-gray-600"}`}>
											{r.content || "요약 내용이 없습니다."}
										</p>
										{r.url && (
											<a
												href={r.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 hover:underline"
											>
												<ExternalLink size={11} />
												원문 보기
											</a>
										)}
									</div>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
};

export default NewsDetailModal;
