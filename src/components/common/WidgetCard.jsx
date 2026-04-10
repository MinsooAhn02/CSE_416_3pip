import { X } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWidgetStore } from "../../store/useWidgetStore";
import DragHandle from "./DragHandle";

/* ── API 디버그 배너 (테스트용 — 나중에 제거) ── */
const STATUS_CLS = {
	ok: { pill: "bg-green-500", banner: "bg-green-500/10 border-green-500/20 text-green-400" },
	error: { pill: "bg-red-500", banner: "bg-red-500/10 border-red-500/20 text-red-400" },
	loading: { pill: "bg-yellow-500", banner: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" },
};

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
}) => {
	const { isDark, cardCls, cardShadowCls, muted, hoverCls } = useTheme();
	const closeWidget = useWidgetStore((s) => s.closeWidget);

	const statusKey = refreshing ? "loading" : apiStatus;
	const cls = STATUS_CLS[statusKey];

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

			{/* ── API 디버그 배너 (테스트용) ── */}
			{cls && (
				<div className={`mb-3 px-2.5 py-1.5 rounded-lg border flex items-center gap-2 flex-wrap ${cls.banner} ${noPad ? "mx-5" : ""}`}>
					<span className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase ${cls.pill}`}>
						{statusKey}
					</span>
					{apiError && (
						<span className="text-[10px] opacity-80 break-all">{apiError}</span>
					)}
					{!apiError && statusKey === "ok" && (
						<span className="text-[10px] opacity-70">실제 API 데이터</span>
					)}
					{!apiError && statusKey === "error" && (
						<span className="text-[10px] opacity-70">mock 데이터 표시 중</span>
					)}
					{statusKey === "loading" && (
						<span className="text-[10px] opacity-70">불러오는 중...</span>
					)}
				</div>
			)}

			<div className={noPad ? "p-5 pt-3" : ""}>{children}</div>
		</div>
	);
};

export default WidgetCard;
