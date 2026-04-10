import { useEffect, useRef } from "react";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import DragHandle from "../common/DragHandle";

const SmartWidgetContent = ({ keyword }) => {
	const { isDark, cardCls, muted, hoverCls, secondaryBgCls, borderCls } = useTheme();
	const removeSmartWidget = useWidgetStore((s) => s.removeSmartWidget);
	const refreshSmartWidget = useWidgetStore((s) => s.refreshSmartWidget);
	const loadSmartWidget = useWidgetStore((s) => s.loadSmartWidget);
	const isRefreshing = useWidgetStore((s) => s.refreshing[keyword]);
	const error = useWidgetStore((s) => s.smartWidgetErrors[keyword]);
	const generatedData = useWidgetStore((s) => s.smartWidgetData[keyword]);

	const data = generatedData;

	/* Guard: only attempt load once per keyword mount.
	 * Without this, a failed load (generatedData=null, isRefreshing=false, error set)
	 * would re-trigger on every render → infinite retry loop. */
	const fetchedRef = useRef(false);
	useEffect(() => {
		fetchedRef.current = false;
	}, [keyword]);
	useEffect(() => {
		if (!generatedData && !isRefreshing && !error && !fetchedRef.current) {
			fetchedRef.current = true;
			loadSmartWidget(keyword);
		}
	}, [generatedData, isRefreshing, error, keyword, loadSmartWidget]);

	if (!data) {
		return (
			<div
				className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl overflow-hidden ${cardCls} h-full`}
			>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<DragHandle />
						<Sparkles
							size={18}
							className={isDark ? "text-yellow-300" : "text-yellow-600"}
						/>
						<h3 className="font-semibold text-sm">🔍 {keyword}</h3>
						<span
							className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
						>
							Smart
						</span>
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
					<div className="text-3xl mb-3 animate-pulse">🤖</div>
					<p className="text-sm font-medium mb-1">
						AI가 &apos;{keyword}&apos;의 핵심 포인트를 분석 중입니다...
					</p>
					<p className={`text-xs ${muted}`}>
						Groq가 포인트 3개를 뽑고 Tavily로 검색한 뒤 다시 정리합니다
					</p>
					{error && <p className="text-xs text-red-400 mt-2">{error}</p>}
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
					<Sparkles
						size={18}
						className={isDark ? "text-yellow-300" : "text-yellow-600"}
					/>
					<h3 className="font-semibold text-sm">
						{data.emoji} {keyword}
					</h3>
					<span
						className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"}`}
					>
						Smart
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<span className={`text-[10px] ${muted}`}>{data.lastUpdated}</span>
					<button
						onClick={() => refreshSmartWidget(keyword)}
						className={`p-1 rounded-lg transition-all ${hoverCls} ${isRefreshing ? "animate-spin" : ""}`}
						title="새로고침"
					>
						<RefreshCw size={12} className={muted} />
					</button>
					<button
						onClick={() => removeSmartWidget(keyword)}
						className={`p-1 rounded-lg ${hoverCls} ${muted} hover:opacity-100`}
						title="위젯 삭제"
					>
						<X size={14} />
					</button>
				</div>
			</div>

			<div>
				{isRefreshing ? (
					<div
						className={`text-center py-6 rounded-xl ${secondaryBgCls}`}
					>
						<RefreshCw
							size={24}
							className="animate-spin mx-auto mb-2 text-blue-400"
						/>
						<p className={`text-xs ${muted}`}>데이터 갱신 중...</p>
					</div>
				) : (
					<>
						{data.sections
							.filter((s) => s.type === "summary")
							.map((section, i) => (
								<div key={i} className="mb-3">
									<p
										className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}
									>
										{section.title}
									</p>
									<div className="space-y-1.5">
										{section.bullets?.map((bullet, j) => (
											<div
												key={j}
												className={`p-2.5 rounded-xl text-xs leading-relaxed ${secondaryBgCls}`}
											>
												{bullet}
											</div>
										))}
									</div>
								</div>
							))}
						{data.sections
							.filter((s) => s.type === "price")
							.map((section, i) => (
								<div key={i} className="mb-3">
									<p
										className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}
									>
										{section.title}
									</p>
									<div className="space-y-1.5">
										{section.items.map((item, j) => (
											<div
												key={j}
												className={`flex items-center justify-between p-2.5 rounded-xl ${secondaryBgCls}`}
											>
												<div>
													<p className="text-xs font-medium">{item.name}</p>
													<p className={`text-[10px] ${muted}`}>
														{item.source}
													</p>
												</div>
												<div className="text-right">
													<p className="text-sm font-bold">{item.price}</p>
													<p
														className={`text-[10px] font-medium ${item.change.startsWith("-") ? "text-blue-400" : "text-red-400"}`}
													>
														{item.change}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							))}
						{data.sections
							.filter((s) => s.type === "trend")
							.map((section, i) => (
								<div key={i} className="mb-3">
									<p
										className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${muted}`}
									>
										{section.title}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{section.tags.map((tag, j) => (
											<span
												key={j}
												className={`text-[10px] px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${secondaryBgCls} ${borderCls} ${hoverCls}`}
											>
												{tag}
											</span>
										))}
									</div>
								</div>
							))}
						{data.sections
							.filter((s) => s.type === "news")
							.map((section, i) => (
								<div key={i}>
									<p
										className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${muted}`}
									>
										{section.title}
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
												<p className="text-xs">{item.title}</p>
												<p className={`text-[10px] ${muted}`}>
													{item.source} · {item.time}
												</p>
											</div>
										))}
									</div>
								</div>
							))}
						<p className={`text-[10px] text-center mt-3 ${muted}`}>
							⚠️ Groq와 Tavily 연동 시 키워드별 실시간 분석이 반영됩니다
						</p>
						{error && (
							<p className="text-[10px] text-center mt-2 text-red-400">
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
