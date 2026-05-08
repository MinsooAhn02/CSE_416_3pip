import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
	const { i18n } = useTranslation();
	const { isDark, cardCls, cardShadowCls, muted, hoverCls } = useTheme();
	const closeWidget = useWidgetStore((s) => s.closeWidget);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const refreshTitle = isKo ? "새로고침" : "Refresh";
	const closeWidgetTitle = isKo ? "위젯 끄기" : "Close widget";

	return (
		<div
			className={`backdrop-blur-md border rounded-2xl ${noPad ? "" : "p-5"} ${cardShadowCls} overflow-hidden transition-all ${cardCls} h-full`}
		>
			<div
				className={`flex items-center justify-between ${noPad ? "p-5 pb-0" : "mb-3"}`}
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
				<div className="flex items-center gap-1.5">
					{headerMeta && (
						<span className={`text-[10px] ${muted}`}>{headerMeta}</span>
					)}
					{onRefresh && RefreshIcon && (
						<button
							onClick={onRefresh}
							className={`${muted} hover:opacity-100 transition-opacity p-1 rounded-lg ${hoverCls}`}
							title={refreshTitle}
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
							title={closeWidgetTitle}
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
