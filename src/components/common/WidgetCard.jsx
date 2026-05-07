import { X, Settings } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import DragHandle from "./DragHandle";

const WidgetCard = ({
	title,
	icon: Icon,
	widgetId,
	children,
	noPad,
	headerMeta,
	onRefresh,
	refreshing,
	refreshIcon: RefreshIcon,
}) => {
	const { isDark, cardCls, cardShadowCls, muted, hoverCls } = useTheme();
	const closeWidget = useWidgetStore((s) => s.closeWidget);
	const openWidgetSettings = useWidgetStore((s) => s.openWidgetSettings);

	return (
		<div
			className={`backdrop-blur-md border rounded-2xl ${noPad ? "" : "p-5"} ${cardShadowCls} overflow-hidden transition-all ${cardCls} h-full`}
		>
			<div
				className={`flex items-center justify-between ${noPad ? "p-5 pb-0" : "mb-3"}`}
			>
				<button
					className="flex items-center gap-2 group"
					onClick={() => widgetId && openWidgetSettings(widgetId)}
					title="위젯 설정"
				>
					<DragHandle />
					{Icon && (
						<Icon
							size={18}
							className={isDark ? "text-blue-300" : "text-blue-600"}
						/>
					)}
					<h3 className="font-semibold text-sm">{title}</h3>
					{widgetId && (
						<Settings
							size={11}
							className={`opacity-0 group-hover:opacity-40 transition-opacity ${muted}`}
						/>
					)}
				</button>
				<div className="flex items-center gap-1.5">
					{headerMeta && (
						<span className={`text-[10px] ${muted}`}>{headerMeta}</span>
					)}
					{onRefresh && RefreshIcon && (
						<button
							onClick={onRefresh}
							className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${hoverCls}`}
							title="새로고침"
						>
							<RefreshIcon
								size={14}
								className={refreshing ? "animate-spin" : ""}
							/>
						</button>
					)}
					{widgetId && (
						<button
							onClick={() => closeWidget(widgetId)}
							className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${hoverCls}`}
							title="위젯 끄기"
						>
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			<div className={noPad ? "p-5 pt-3" : ""}>{children}</div>
		</div>
	);
};

export default WidgetCard;
