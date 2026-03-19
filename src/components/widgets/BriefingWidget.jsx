import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDataStore } from "../../store/useDataStore";
import { useTodoStore } from "../../store/useTodoStore";
import { useDiaryStore } from "../../store/useDiaryStore";
import {
	generateDetailedBriefing,
	getTimeGreeting,
} from "../../services/aiService";
import { mockBriefings } from "../../mock/data";

/** 스켈레톤 라인 컴포넌트 */
const SkeletonLine = ({ width = "100%" }) => (
	<div
		className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
		style={{ width }}
	/>
);

/** 스켈레톤 UI - 상세 브리핑 로딩 시 표시 */
const BriefingSkeleton = () => (
	<motion.div
		className="space-y-3"
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<SkeletonLine width="90%" />
		<SkeletonLine width="100%" />
		<SkeletonLine width="85%" />
		<div className="h-2" />
		<SkeletonLine width="95%" />
		<SkeletonLine width="80%" />
		<SkeletonLine width="100%" />
		<SkeletonLine width="70%" />
		<div className="h-2" />
		<SkeletonLine width="88%" />
		<SkeletonLine width="92%" />
		<SkeletonLine width="75%" />
	</motion.div>
);

const BriefingWidget = () => {
	const { isDark, cardCls, muted } = useTheme();
	const tone = useSettingsStore((s) => s.tone);
	const length = useSettingsStore((s) => s.briefingLength) || "medium";
	const activeWidgetIds = useSettingsStore((s) => s.activeWidgetIds) || [];

	// 데이터 스토어에서 컨텍스트 수집
	const weather = useDataStore((s) => s.weather);
	const stocks = useDataStore((s) => s.stocks);
	const trends = useDataStore((s) => s.trends);
	const calEvents = useDataStore((s) => s.calEvents);
	const todos = useTodoStore((s) => s.todos);

	// 전날 메모 가져오기
	const getDiary = useDiaryStore((s) => s.getDiary);
	const yesterdayMemo = useMemo(() => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const dateStr = yesterday.toISOString().slice(0, 10);
		return getDiary(dateStr)?.memo || "";
	}, [getDiary]);

	// 상태 관리
	const [detailedBriefing, setDetailedBriefing] = useState(null); // { summary, detail }
	const [isLoading, setIsLoading] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const [lastGenerated, setLastGenerated] = useState(null);

	// 스크롤 잠금 및 Layout Shift 방지
	useEffect(() => {
		if (isExpanded) {
			const scrollbarWidth =
				window.innerWidth - document.documentElement.clientWidth;
			document.body.style.overflow = "hidden";
			document.body.style.paddingRight = `${scrollbarWidth}px`;
		}
		return () => {
			document.body.style.overflow = "";
			document.body.style.paddingRight = "";
		};
	}, [isExpanded]);

	// AI 상세 브리핑 생성
	const generateNewBriefing = async () => {
		setIsLoading(true);
		try {
			const context = {
				weather,
				stocks,
				trends,
				calEvents,
				todos,
				activeWidgetIds,
				yesterdayMemo,
			};
			const result = await generateDetailedBriefing({ context, tone, length });
			if (result) {
				setDetailedBriefing(result);
				setLastGenerated(new Date());
			}
		} catch (e) {
			console.warn("Briefing generation failed:", e?.message);
		} finally {
			setIsLoading(false);
		}
	};

	// 초기 로드 시 브리핑 생성 (하이브리드: 최초 1회)
	useEffect(() => {
		if (!detailedBriefing && !isLoading) {
			generateNewBriefing();
		}
	}, [tone]);

	// 폴백: AI 생성 실패 시 mock 데이터 사용
	const displayBriefing = useMemo(() => {
		if (detailedBriefing) {
			return {
				summary: detailedBriefing.summary || "오늘의 AI 브리핑",
				detail: detailedBriefing.detail || "",
			};
		}
		return mockBriefings[tone] || mockBriefings.friendly;
	}, [detailedBriefing, tone]);

	// 요약 텍스트 줄 분리
	const summaryLines = (displayBriefing.summary || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	// 상세 텍스트 줄 분리
	const detailLines = (displayBriefing.detail || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	// 시간대별 인사말
	const greeting = useMemo(() => getTimeGreeting(), []);

	// 새로고침 버튼 클릭 핸들러
	const handleRefresh = (e) => {
		e.stopPropagation();
		generateNewBriefing();
	};

	// 위젯 클릭 핸들러
	const handleWidgetClick = () => {
		if (!isLoading) {
			setIsExpanded(true);
		}
	};

	// 상세 창 닫기
	const handleClose = () => {
		setIsExpanded(false);
	};

	return (
		<>
			{/* 위젯 카드 - 클릭 시 상세 창 열림 */}
			<div
				onClick={handleWidgetClick}
				className={`h-full rounded-2xl border p-5 shadow-sm transition-colors duration-300 cursor-pointer hover:shadow-md ${cardCls}`}
			>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<Sparkles size={18} className="text-blue-500" />
						<h2 className="font-bold text-sm">AI 브리핑</h2>
					</div>
					<button
						onClick={handleRefresh}
						disabled={isLoading}
						className={`p-1.5 rounded-full transition-colors ${
							isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
						} ${isLoading ? "opacity-50" : ""}`}
						title="브리핑 새로고침"
					>
						<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
					</button>
				</div>

				<p className={`text-xs uppercase tracking-widest mb-3 ${muted}`}>
					Daily Briefing
				</p>

				<p className="text-sm font-medium mb-3">오늘의 AI 브리핑</p>

				<div className="space-y-2">
					{isLoading && !detailedBriefing ? (
						<div className="space-y-2">
							<SkeletonLine width="90%" />
							<SkeletonLine width="100%" />
							<SkeletonLine width="85%" />
						</div>
					) : (
						summaryLines.map((line, idx) => (
							<p key={idx} className={`text-xs leading-relaxed ${muted}`}>
								{line}
							</p>
						))
					)}
				</div>

				{/* 전날 메모 반영 표시 */}
				{yesterdayMemo && (
					<p className={`mt-3 text-[10px] ${muted}`}>
						✨ 어제 메모가 브리핑에 반영되었습니다
					</p>
				)}

				{/* 클릭 안내 */}
				<p className={`mt-4 text-[10px] ${muted} text-center`}>
					클릭하여 상세 브리핑 확인
				</p>
			</div>

			{/* 상세 브리핑 모달 */}
			<AnimatePresence>
				{isExpanded && (
					<>
						{/* 배경 오버레이 */}
						<motion.div
							className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md"
							onClick={handleClose}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						/>

						{/* 상세 창 본체 */}
						<motion.div
							className={`fixed top-1/2 left-1/2 z-[61] w-full max-w-2xl max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
								isDark
									? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
									: "bg-white border-gray-200 text-slate-800"
							}`}
							style={{ x: "-50%", y: "-50%" }}
							initial={{ opacity: 0, scale: 0.5 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.5 }}
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
							onClick={(e) => e.stopPropagation()}
						>
							{/* 헤더 */}
							<div className="flex items-center justify-between p-5 border-b border-inherit">
								<div className="flex items-center gap-3">
									<Sparkles size={22} className="text-blue-500" />
									<h3 className="font-bold text-base">상세 브리핑</h3>
								</div>
								<div className="flex items-center gap-2">
									<button
										onClick={handleRefresh}
										disabled={isLoading}
										className={`p-2 rounded-full transition-colors ${
											isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
										} ${isLoading ? "opacity-50" : ""}`}
										title="브리핑 새로고침"
									>
										<RefreshCw
											size={16}
											className={isLoading ? "animate-spin" : ""}
										/>
									</button>
									<button
										onClick={handleClose}
										className={`p-2 rounded-full transition-colors ${
											isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
										}`}
									>
										<X size={18} />
									</button>
								</div>
							</div>

							{/* 시간대별 인사말 */}
							<div
								className={`px-5 py-4 border-b ${
									isDark
										? "border-[#3a3a3a] bg-[#252525]"
										: "border-gray-100 bg-blue-50/30"
								}`}
							>
								<p
									className={`text-sm leading-relaxed ${
										isDark ? "text-blue-300" : "text-blue-700"
									}`}
								>
									{greeting}
								</p>
							</div>

							{/* 상세 브리핑 콘텐츠 */}
							<div className="flex-1 overflow-y-auto p-5 space-y-4">
								<AnimatePresence mode="wait">
									{isLoading ? (
										<BriefingSkeleton key="skeleton" />
									) : (
										<motion.div
											key="content"
											className="space-y-3"
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.3 }}
										>
											{detailLines.length > 0 ? (
												detailLines.map((line, idx) => (
													<p
														key={idx}
														className={`text-sm leading-relaxed ${
															isDark ? "text-gray-300" : "text-gray-700"
														}`}
													>
														{line}
													</p>
												))
											) : (
												<p className={`text-sm ${muted}`}>
													상세 브리핑을 불러오는 중입니다...
												</p>
											)}
										</motion.div>
									)}
								</AnimatePresence>

								{/* 전날 메모 반영 표시 */}
								{yesterdayMemo && (
									<div
										className={`mt-4 p-3 rounded-lg ${
											isDark ? "bg-[#2a2a2a]" : "bg-gray-50"
										}`}
									>
										<p className={`text-xs ${muted}`}>
											✨ 어제 메모가 브리핑에 반영되었습니다
										</p>
									</div>
								)}

								{/* 마지막 생성 시간 */}
								{lastGenerated && (
									<p className={`text-[10px] ${muted} text-right`}>
										마지막 업데이트:{" "}
										{lastGenerated.toLocaleTimeString("ko-KR", {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
								)}
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	);
};

export default BriefingWidget;
