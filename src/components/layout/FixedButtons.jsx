import { useState, useRef, useEffect } from "react";
import { Settings, Plus, X, Sparkles } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useWidgetStore } from "../../store/useWidgetStore";

const FixedButtons = () => {
	const { isDark, inputCls, muted } = useTheme();
	const setShowSettings = useSettingsStore((s) => s.setShowSettings);
	const newKeyword = useWidgetStore((s) => s.newKeyword);
	const setNewKeyword = useWidgetStore((s) => s.setNewKeyword);
	const addSmartWidget = useWidgetStore((s) => s.addSmartWidget);

	const [showPopup, setShowPopup] = useState(false);
	const popupRef = useRef(null);

	useEffect(() => {
		if (!showPopup) return;
		const handler = (e) => {
			if (popupRef.current && !popupRef.current.contains(e.target)) {
				setShowPopup(false);
				setNewKeyword("");
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showPopup, setNewKeyword]);

	const handleAdd = () => {
		addSmartWidget();
		setShowPopup(false);
	};

	const btnBase = `w-12 h-12 backdrop-blur-md border rounded-full flex items-center justify-center transition-all shadow-lg group ${
		isDark
			? "bg-white/5 hover:bg-white/15 border-white/10"
			: "bg-white/50 hover:bg-white/80 border-gray-200"
	}`;

	return (
		<div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3 items-end">
			{/* Add Smart Widget */}
			<div className="relative" ref={popupRef}>
				{showPopup && (
					<div
						className={`absolute bottom-0 right-14 w-72 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl ${
							isDark
								? "bg-[#2a2a2a]/90 border-white/10"
								: "bg-white/90 border-gray-200"
						}`}
					>
						<div className="flex items-center gap-2 mb-3">
							<Sparkles
								size={16}
								className={isDark ? "text-yellow-300" : "text-yellow-600"}
							/>
							<span className="font-semibold text-sm">스마트 위젯 추가</span>
							<button
								onClick={() => {
									setShowPopup(false);
									setNewKeyword("");
								}}
								className="ml-auto"
							>
								<X size={14} className={muted} />
							</button>
						</div>
						<div className="flex gap-2">
							<input
								type="text"
								value={newKeyword}
								onChange={(e) => setNewKeyword(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleAdd()}
								placeholder="키워드 입력..."
								autoFocus
								className={`flex-grow rounded-xl px-3 py-2 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
							/>
							<button
								onClick={handleAdd}
								className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
							>
								추가
							</button>
						</div>
					</div>
				)}
				<button
					onClick={() => setShowPopup((p) => !p)}
					title="스마트 위젯 추가"
					className={btnBase}
				>
					<Plus size={22} className="opacity-60" />
				</button>
			</div>

			{/* Settings */}
			<button onClick={() => setShowSettings(true)} className={btnBase}>
				<Settings
					size={22}
					className="opacity-60 group-hover:rotate-45 transition-transform duration-500"
				/>
			</button>
		</div>
	);
};

export default FixedButtons;
