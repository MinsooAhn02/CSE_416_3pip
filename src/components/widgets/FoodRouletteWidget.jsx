import { useState } from "react";
import { Star } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { mockFoods } from "../../mock/data";
import WidgetCard from "../common/WidgetCard";

const FoodRouletteWidget = () => {
	const { isDark, muted } = useTheme();
	const [rouletteResult, setRouletteResult] = useState(null);
	const [spinning, setSpinning] = useState(false);

	const spinRoulette = () => {
		if (spinning) return;
		setSpinning(true);
		setRouletteResult(null);
		let c = 0;
		const iv = setInterval(() => {
			setRouletteResult(
				mockFoods[Math.floor(Math.random() * mockFoods.length)],
			);
			if (++c >= 20) {
				clearInterval(iv);
				setSpinning(false);
			}
		}, 100);
	};

	return (
		<WidgetCard title="메뉴 결정 도우미" icon={Star} widgetId="foodRoulette">
			<div className="text-center py-2">
				<div
					className={`text-4xl font-bold mb-3 h-14 flex items-center justify-center rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"} ${spinning ? "animate-pulse" : ""}`}
				>
					{rouletteResult ? (
						<span>
							{spinning ? "🎰" : "🍽️"} {rouletteResult}
						</span>
					) : (
						<span className={`text-lg ${muted}`}>오늘 뭐 먹지?</span>
					)}
				</div>
				<button
					onClick={spinRoulette}
					disabled={spinning}
					className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${spinning ? "opacity-50 cursor-not-allowed" : ""} ${isDark ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
				>
					{spinning
						? "돌리는 중..."
						: rouletteResult
							? "다시 돌리기 🎲"
							: "룰렛 돌리기 🎲"}
				</button>
			</div>
		</WidgetCard>
	);
};

export default FoodRouletteWidget;
