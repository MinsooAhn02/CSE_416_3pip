import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import DragHandle from "./DragHandle";

interface WidgetCardProps {
	title: string;
	icon?: React.ComponentType<{ className?: string; size?: number }>;
	widgetId: string;
	children: React.ReactNode;
	noPad?: boolean;
	headerMeta?: React.ReactNode;
	onRefresh?: () => void | Promise<void>;
	refreshing?: boolean;
	refreshIcon?: React.ComponentType<{ className?: string; size?: number }>;
	apiStatus?: string | null;
	apiError?: string | null;
}

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
	apiStatus,
	apiError,
}: WidgetCardProps) => {
	const { i18n } = useTranslation();
	const { isDark, cardCls, cardShadowCls, muted, hoverCls } = useTheme();
	const closeWidget = useWidgetStore((s) => s.closeWidget);
	const isKo = i18n.language?.toLowerCase().startsWith("ko");
	const refreshTitle = isKo ? "새로고침" : "Refresh";
	const closeWidgetTitle = isKo ? "위젯 끄기" : "Close widget";

	return (
		<div
			className={`border rounded-[14px] ${noPad ? "" : "p-4"} ${cardShadowCls} overflow-hidden transition-all ${cardCls} h-full`}
		>
			<div
				className={`flex items-center justify-between ${noPad ? "px-4 pt-4 pb-0" : "mb-3"}`}
			>
				<div className="flex items-center gap-2">
					<DragHandle />
					{Icon && (
						<Icon
							size={15}
							className={
								isDark
									? "text-morning-dark-accent"
									: "text-morning-light-accent"
							}
						/>
					)}
					<h3 className="font-semibold text-[13px]">{title}</h3>
				</div>

				<div className="flex items-center gap-1">
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
								size={13}
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
							<X size={13} />
						</button>
					)}
				</div>
			</div>

			<div className={noPad ? "px-4 pt-3 pb-4" : ""}>{children}</div>
		</div>
	);
};

export default WidgetCard;
