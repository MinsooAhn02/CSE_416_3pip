import { Sparkles, X, RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import { mockSmartWidgets } from "../../mock/data";
import DragHandle from "../common/DragHandle";

const SmartWidgetContent = ({ keyword }) => {
	const { isDark, cardCls, muted } = useTheme();
	const removeSmartWidget = useWidgetStore((s) => s.removeSmartWidget);
	const refreshSmartWidget = useWidgetStore((s) => s.refreshSmartWidget);
	const isRefreshing = useWidgetStore((s) => s.refreshing[keyword]);

	const data = mockSmartWidgets[keyword];

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
						className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
					>
						<X size={14} />
					</button>
				</div>
				<div
					className={`text-center py-8 rounded-xl flex flex-col items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-50"}`}
				>
					<div className="text-3xl mb-3 animate-pulse">🤖</div>
					<p className="text-sm font-medium mb-1">
						AI가 &apos;{keyword}&apos; 데이터를 수집 중입니다...
					</p>
					<p className={`text-xs ${muted}`}>
						백엔드 연동 시 실시간 데이터가 표시됩니다
					</p>
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
						className={`p-1 rounded-lg transition-all ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"} ${isRefreshing ? "animate-spin" : ""}`}
						title="새로고침"
					>
						<RefreshCw size={12} className={muted} />
					</button>
					<button
						onClick={() => removeSmartWidget(keyword)}
						className={`p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"} ${muted} hover:opacity-100`}
						title="위젯 삭제"
					>
						<X size={14} />
					</button>
				</div>
			</div>

			<div>
				{isRefreshing ? (
					<div
						className={`text-center py-6 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
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
												className={`flex items-center justify-between p-2.5 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}
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
												className={`text-[10px] px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${isDark ? "bg-white/5 border-white/10 hover:bg-white/15" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
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
							⚠️ 백엔드 연동 시 AI가 실시간 데이터를 자동 수집합니다
						</p>
					</>
				)}
			</div>
		</div>
	);
};

export default SmartWidgetContent;
