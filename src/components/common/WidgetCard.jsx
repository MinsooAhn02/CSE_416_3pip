import { X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import DragHandle from "./DragHandle";

const WidgetCard = ({ title, icon: Icon, widgetId, children, noPad }) => {
	const { isDark, cardCls, muted } = useTheme();
	const closeWidget = useWidgetStore((s) => s.closeWidget);

	return (
		<div
			className={`backdrop-blur-md border rounded-2xl ${noPad ? "" : "p-5"} shadow-xl h-full overflow-auto transition-all ${cardCls}`}
		>
			<div
				className={`flex items-center justify-between ${noPad ? "p-5 pb-0" : "mb-4"}`}
			>
				<div className="flex items-center gap-2">
					<DragHandle />
					{Icon && (
						<Icon
							size={18}
							className={isDark ? "text-blue-300" : "text-blue-600"}
						/>
					)}
					<h3 className="font-semibold text-sm">{title}</h3>
				</div>
				{widgetId && (
					<button
						onClick={() => closeWidget(widgetId)}
						className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
						title="위젯 끄기"
					>
						<X size={14} />
					</button>
				)}
			</div>
			<div className={noPad ? "p-5 pt-3" : ""}>{children}</div>
		</div>
	);
};

export default WidgetCard;
