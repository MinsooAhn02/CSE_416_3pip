import { useEffect, useRef } from "react";
import { Search, X, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import { useFontSize } from "../../hooks/useFontSize";
import DragHandle from "../common/DragHandle";

const SmartWidgetContent = ({ keyword }) => {
	const { isDark, cardCls, muted, hoverCls, secondaryBgCls } = useTheme();
	const { body: bodyStyle, title: titleStyle } = useFontSize();
	const { i18n } = useTranslation();
	const isKo = i18n.language?.startsWith("ko");

	const removeSmartWidget = useWidgetStore((s) => s.removeSmartWidget);
	const refreshSmartWidget = useWidgetStore((s) => s.refreshSmartWidget);
	const loadSmartWidget = useWidgetStore((s) => s.loadSmartWidget);
	const isRefreshing = useWidgetStore((s) => s.refreshing[keyword]);
	const error = useWidgetStore((s) => s.smartWidgetErrors[keyword]);

	const lang = isKo ? "ko" : "en";
	const cacheKey = `${keyword}_${lang}`;
	const generatedData = useWidgetStore((s) => s.smartWidgetData[cacheKey]);

	const data = generatedData;

	/* Guard: reset when keyword OR language changes to allow re-fetch */
	const fetchedRef = useRef(false);
	useEffect(() => {
		fetchedRef.current = false;
	}, [keyword, lang]);
	useEffect(() => {
		if (!generatedData && !isRefreshing && !error && !fetchedRef.current) {
			fetchedRef.current = true;
			loadSmartWidget(keyword);
		}
	}, [generatedData, isRefreshing, error, keyword, loadSmartWidget]);

	const loadingMsg = isKo
		? `'${keyword}' 검색 중...`
		: `Searching '${keyword}'...`;

	const getLocalizedSectionTitle = (section) => {
		if (section?.type === "summary") {
			return isKo ? "맞춤 검색" : "Personalized Search";
		}
		if (section?.type === "news") {
			return isKo ? "관련 정보" : "Related Info";
		}
		return section?.title || "";
	};

	if (!data) {
		return (
			<div
				className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl overflow-hidden ${cardCls} h-full`}
			>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<DragHandle />
						<Search
							size={16}
							className={isDark ? "text-blue-300" : "text-blue-600"}
						/>
						<h3 className="font-semibold text-sm">{keyword}</h3>
					</div>
					<button
						onClick={() => removeSmartWidget(keyword)}
						className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${hoverCls}`}
					>
						<X size={14} />
					</button>
				</div>
				<div
					className={`text-center py-8 rounded-xl flex flex-col items-center justify-center ${secondaryBgCls}`}
				>
					<div className="text-3xl mb-3 animate-pulse">🔍</div>
					<p className={`font-medium mb-1 ${muted}`} style={bodyStyle}>{loadingMsg}</p>
					{error && <p className="text-red-400 mt-2" style={bodyStyle}>{error}</p>}
				</div>
			</div>
		);
	}

	return (
		<div
			className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl overflow-hidden ${cardCls} h-full`}
		>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<DragHandle />
					<Search
						size={16}
						className={isDark ? "text-blue-300" : "text-blue-600"}
					/>
					<h3 className="font-semibold text-sm">
						{data.emoji} {keyword}
					</h3>
				</div>
				<div className="flex items-center gap-1.5">
					<span className={`text-[10px] ${muted}`}>{data.lastUpdated}</span>
					<button
						onClick={() => refreshSmartWidget(keyword)}
						className={`p-1 rounded-lg transition-all ${hoverCls} ${isRefreshing ? "animate-spin" : ""}`}
						title={isKo ? "새로고침" : "Refresh"}
					>
						<RefreshCw size={12} className={muted} />
					</button>
					<button
						onClick={() => removeSmartWidget(keyword)}
						className={`p-1 rounded-lg ${hoverCls} ${muted} hover:opacity-100`}
						title={isKo ? "위젯 삭제" : "Remove widget"}
					>
						<X size={14} />
					</button>
				</div>
			</div>

			<div>
				{isRefreshing ? (
					<div className={`text-center py-6 rounded-xl ${secondaryBgCls}`}>
						<RefreshCw
							size={24}
							className="animate-spin mx-auto mb-2 text-blue-400"
						/>
						<p className={`text-xs ${muted}`}>
							{isKo ? "데이터 갱신 중..." : "Updating..."}
						</p>
					</div>
				) : (
					<>
						{data.sections
							.filter((s) => s.type === "summary")
							.map((section, i) => (
								<div key={i} className="mb-3">
									<p
										className={`font-bold uppercase tracking-wider mb-2 ${muted}`}
									style={titleStyle}
									>
										{getLocalizedSectionTitle(section)}
									</p>
									<div
										className={`px-3 py-2.5 rounded-xl ${secondaryBgCls} space-y-1.5`}
									>
										{section.bullets?.map((bullet, j) => (
											<p
												key={j}
												className="leading-relaxed flex gap-1.5"
									style={bodyStyle}
											>
												<span className={`${muted} shrink-0`}>•</span>
												<span>{bullet}</span>
											</p>
										))}
									</div>
								</div>
							))}
						{data.sections
							.filter((s) => s.type === "news")
							.map((section, i) => (
								<div key={i}>
									<p
										className={`font-bold uppercase tracking-wider mb-1.5 ${muted}`}
									style={titleStyle}
									>
										{getLocalizedSectionTitle(section)}
									</p>
									<div className="space-y-1">
										{section.items.map((item, j) => (
											<div
												key={j}
												className={`p-2 rounded-lg cursor-pointer transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
												onClick={() =>
													item.url &&
													window.open(item.url, "_blank", "noopener,noreferrer")
												}
											>
												<p style={bodyStyle}>{item.title}</p>
												<p className={muted} style={bodyStyle}>
													{item.source} · {item.time}
												</p>
											</div>
										))}
									</div>
								</div>
							))}
						{error && (
							<p className="text-center mt-2 text-red-400" style={bodyStyle}>
								{error}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default SmartWidgetContent;
