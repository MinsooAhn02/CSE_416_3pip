import { ShoppingBag } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { mockBrandDrops } from "../../mock/data";
import { dday } from "../../utils/helpers";
import WidgetCard from "../common/WidgetCard";

const BrandDropWidget = () => {
	const { isDark, muted } = useTheme();

	return (
		<WidgetCard
			title="브랜드 Drop D-Day"
			icon={ShoppingBag}
			widgetId="brandDrop"
		>
			<div className="space-y-2">
				{mockBrandDrops.map((item, i) => {
					const d = dday(item.date);
					return (
						<div
							key={i}
							className={`flex items-center justify-between p-2 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}
						>
							<div className="flex items-center gap-2">
								<span className="text-lg">{item.emoji}</span>
								<div>
									<p className="text-xs font-bold">{item.brand}</p>
									<p className={`text-[10px] ${muted}`}>{item.product}</p>
								</div>
							</div>
							<span
								className={`text-xs font-bold px-2 py-1 rounded-lg ${
									d <= 3
										? "bg-red-500/20 text-red-400"
										: d <= 7
											? "bg-yellow-500/20 text-yellow-400"
											: isDark
												? "bg-white/10"
												: "bg-gray-200"
								}`}
							>
								{d <= 0 ? "🔥 TODAY" : `D-${d}`}
							</span>
						</div>
					);
				})}
				<p className={`text-[10px] text-center ${muted}`}>
					⚠️ 백엔드 연동 시 AI가 발매 정보를 자동 추적합니다
				</p>
			</div>
		</WidgetCard>
	);
};

export default BrandDropWidget;
