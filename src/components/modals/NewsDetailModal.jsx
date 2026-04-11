import { useState } from "react";
import { createPortal } from "react-dom";
import {
	X,
	ExternalLink,
	ChevronDown,
	ChevronUp,
	Newspaper,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

/**
 * 뉴스 상세 모달 — 요약 리스트 + 개별 클릭 시 content 확장 + 원문 링크
 * @param {{ results: Array, answer: string, onClose: () => void, hostElement?: HTMLElement | null }} props
 */
const NewsDetailModal = ({
	results = [],
	answer = "",
	onClose,
	hostElement = null,
}) => {
	const { isDark, cardCls, secondaryBgCls, borderCls, hoverCls } = useTheme();
	const [expandedIdx, setExpandedIdx] = useState(null);

	const toggleExpand = (idx) => {
		setExpandedIdx((prev) => (prev === idx ? null : idx));
	};

	if (typeof document === "undefined") return null;
	const sectionFillMode = !!hostElement;
	const portalTarget = hostElement || document.body;

	return createPortal(
		/* 반투명 오버레이 */
		<div
			className={
				sectionFillMode
					? "absolute inset-0 z-[120] p-2 sm:p-3 xl:p-4"
					: "fixed inset-0 z-[60] flex items-center justify-center p-4"
			}
			onClick={onClose}
		>
			{/* 배경 블러 */}
			<div
				className={
					sectionFillMode
						? `absolute inset-2 sm:inset-3 xl:inset-4 rounded-2xl ${
								isDark
									? "bg-black/10 backdrop-blur-[0.5px]"
									: "bg-slate-900/6 backdrop-blur-[0.5px]"
							}`
						: "absolute inset-0 bg-black/50 backdrop-blur-sm"
				}
			/>

			{/* 모달 본체 */}
			<div
				className={`z-10 rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${cardCls} ${
					sectionFillMode
						? "relative h-full w-full max-h-full"
						: "relative w-full max-w-2xl max-h-[82vh]"
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
						className={`p-1 rounded-full transition-colors ${hoverCls}`}
					>
						<X size={18} />
					</button>
				</div>

				{/* AI 전체 요약 */}
				{answer && (
					<div className={`px-4 py-3 border-b ${borderCls} ${secondaryBgCls}`}>
						<p
							className={`text-xs leading-relaxed ${isDark ? "text-blue-300" : "text-blue-700"}`}
						>
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
								className={`rounded-xl border transition-colors ${`${borderCls} ${hoverCls}`}`}
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
										<ChevronDown
											size={14}
											className="flex-shrink-0 opacity-50"
										/>
									)}
								</button>

								{/* 확장 시 content + 원문 링크 */}
								{expandedIdx === idx && (
									<div className={`px-3 pb-3 space-y-2 border-t ${borderCls}`}>
										<p
											className={`text-xs leading-relaxed pt-2 ${isDark ? "opacity-70" : "text-gray-600"}`}
										>
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
		</div>,
		portalTarget,
	);
};

export default NewsDetailModal;
