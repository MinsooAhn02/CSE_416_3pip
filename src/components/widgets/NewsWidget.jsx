import { useState, useEffect } from "react";
import { Newspaper, ExternalLink, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDataStore } from "../../store/useDataStore";
import WidgetCard from "../common/WidgetCard";
import NewsDetailModal from "../modals/NewsDetailModal";

const formatLastUpdated = (minutes) => {
	if (minutes == null) return "갱신 전";
	if (minutes <= 0) return "방금 갱신";
	return `${minutes}분 전`;
};

const NewsWidget = () => {
	const { isDark } = useTheme();
	const newsResults = useDataStore((s) => s.newsResults);
	const newsAnswer = useDataStore((s) => s.newsAnswer);
	const loading = useDataStore((s) => s.loading.news);
	const error = useDataStore((s) => s.errors.news);
	const fetchNews = useDataStore((s) => s.fetchNews);
	const getLastUpdatedMinutes = useDataStore((s) => s.getLastUpdatedMinutes);
	const lastUpdatedText = formatLastUpdated(getLastUpdatedMinutes("news"));

	const [showNewsModal, setShowNewsModal] = useState(false);

	// 컴포넌트 마운트 시 뉴스 로드
	useEffect(() => {
		if (!newsResults || newsResults.length === 0) {
			fetchNews();
		}
	}, []);

	const newsItems = newsResults || [];

	return (
		<>
			<WidgetCard
				title="뉴스"
				icon={Newspaper}
				widgetId="news"
				headerMeta={lastUpdatedText}
				onRefresh={() => fetchNews(undefined, true)}
				refreshing={!!loading}
				refreshIcon={RefreshCw}
			>
				{error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
				{loading ? (
					<p className="text-sm opacity-60">뉴스를 불러오는 중...</p>
				) : newsItems.length === 0 ? (
					<p className="text-sm opacity-60">표시할 뉴스가 없습니다.</p>
				) : (
					<div className="space-y-3">
						{/* AI 요약 */}
						{newsAnswer && (
							<p className={`text-xs leading-relaxed ${isDark ? "opacity-80" : "text-slate-600"}`}>
								{newsAnswer}
							</p>
						)}

						{/* 뉴스 목록 */}
						<div className="space-y-1.5">
							{newsItems.slice(0, 5).map((item, i) => (
								<button
									key={i}
									onClick={() => setShowNewsModal(true)}
									className={`w-full flex items-start gap-2 p-2 rounded-lg text-xs transition-colors text-left ${
										isDark
											? "hover:bg-[#333333] bg-[#2a2a2a]"
											: "hover:bg-gray-100 bg-gray-50"
									}`}
								>
									<ExternalLink size={12} className="mt-0.5 shrink-0 opacity-40" />
									<div className="flex-1 min-w-0">
										<span className={`line-clamp-2 font-medium ${isDark ? "text-blue-300" : "text-blue-600"}`}>
											{item.title || item.url}
										</span>
										{item.content && (
											<p className={`line-clamp-1 mt-0.5 ${isDark ? "opacity-50" : "text-slate-500"}`}>
												{item.content}
											</p>
										)}
									</div>
								</button>
							))}
							{newsItems.length > 5 && (
								<button
									onClick={() => setShowNewsModal(true)}
									className="text-[10px] text-blue-400 hover:underline mt-1 w-full text-center py-1"
								>
									+{newsItems.length - 5}건 더 보기
								</button>
							)}
						</div>
					</div>
				)}
			</WidgetCard>

			{/* 뉴스 상세 모달 */}
			{showNewsModal && (
				<NewsDetailModal
					results={newsItems}
					answer={newsAnswer || ""}
					onClose={() => setShowNewsModal(false)}
				/>
			)}
		</>
	);
};

export default NewsWidget;
