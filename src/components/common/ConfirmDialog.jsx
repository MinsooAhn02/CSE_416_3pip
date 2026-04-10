import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

/**
 * ConfirmDialog — modal-style confirm, replaces native browser confirm().
 *
 * Props:
 *   title?    — optional heading (default: "확인")
 *   message   — body text
 *   confirmLabel?  — confirm button label (default: "확인")
 *   cancelLabel?   — cancel button label (default: "취소")
 *   danger?        — if true, confirm button is red (default: true)
 *   onConfirm — called when user confirms
 *   onCancel  — called when user cancels or clicks backdrop
 */
const ConfirmDialog = ({
	title = "확인",
	message,
	confirmLabel = "확인",
	cancelLabel = "취소",
	danger = true,
	onConfirm,
	onCancel,
}) => {
	const { isDark, hoverCls } = useTheme();

	const cardCls = isDark
		? "bg-morning-dark-card border-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-card border-morning-light-hover/50 text-morning-light-text";

	const cancelCls = isDark
		? "bg-morning-dark-cardSecondary hover:bg-morning-dark-hover text-morning-dark-text"
		: "bg-morning-light-cardSecondary hover:bg-morning-light-hover/70 text-morning-light-text";

	const confirmCls = danger
		? "bg-red-500 hover:bg-red-600 text-white"
		: "bg-blue-500 hover:bg-blue-600 text-white";

	if (typeof document === "undefined") return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[30000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
			onClick={onCancel}
		>
			<div
				className={`w-full max-w-sm rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${cardCls}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-start gap-3">
					<AlertTriangle
						size={20}
						className={`mt-0.5 flex-shrink-0 ${danger ? "text-red-400" : "text-amber-400"}`}
					/>
					<div className="space-y-1">
						<h3 className="font-bold text-base">{title}</h3>
						{message && (
							<p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
								{message}
							</p>
						)}
					</div>
				</div>

				<div className="flex gap-2 pt-2">
					<button
						onClick={onCancel}
						className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${cancelCls}`}
					>
						{cancelLabel}
					</button>
					<button
						onClick={onConfirm}
						className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${confirmCls}`}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
};

export default ConfirmDialog;
