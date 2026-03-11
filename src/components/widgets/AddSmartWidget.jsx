import { Plus, X, Sparkles } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";

const AddSmartWidget = () => {
	const { isDark, cardCls, inputCls, muted } = useTheme();
	const showAddSmart = useWidgetStore((s) => s.showAddSmart);
	const newKeyword = useWidgetStore((s) => s.newKeyword);
	const setShowAddSmart = useWidgetStore((s) => s.setShowAddSmart);
	const setNewKeyword = useWidgetStore((s) => s.setNewKeyword);
	const addSmartWidget = useWidgetStore((s) => s.addSmartWidget);

	if (showAddSmart) {
		return (
			<div
				className={`backdrop-blur-md border rounded-2xl p-4 shadow-xl h-full ${cardCls}`}
			>
				<div className="flex items-center gap-2 mb-2">
					<Sparkles
						size={16}
						className={isDark ? "text-yellow-300" : "text-yellow-600"}
					/>
					<span className="font-semibold text-xs">스마트 위젯 추가</span>
				</div>
				<div className="flex gap-2">
					<input
						type="text"
						value={newKeyword}
						onChange={(e) => setNewKeyword(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && addSmartWidget()}
						placeholder="키워드 입력..."
						autoFocus
						className={`flex-grow rounded-xl px-3 py-2 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
					/>
					<button
						onClick={addSmartWidget}
						className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-xl text-xs font-bold"
					>
						추가
					</button>
					<button
						onClick={() => {
							setShowAddSmart(false);
							setNewKeyword("");
						}}
					>
						<X size={14} className={muted} />
					</button>
				</div>
			</div>
		);
	}

	return (
		<button
			onClick={() => setShowAddSmart(true)}
			className={`w-full h-full backdrop-blur-md border-2 border-dashed rounded-2xl flex items-center justify-center gap-2 transition-all ${
				isDark
					? "border-white/20 hover:bg-white/5 text-white/60 hover:text-white/80"
					: "border-gray-300 hover:bg-gray-50 text-gray-400 hover:text-gray-600"
			}`}
		>
			<Plus size={16} />
			<span className="text-sm font-medium">스마트 위젯 추가</span>
		</button>
	);
};

export default AddSmartWidget;
