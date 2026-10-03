import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";

/** Google 토큰 갱신 실패 시 — 캘린더/할 일/건강이 캐시로 대체되고 있음을 알리고 재연결 유도 */
const GoogleReconnectBanner = () => {
	const { t } = useTranslation();
	const needed = useAuthStore((s) => s.googleReconnectNeeded);
	const dismiss = useAuthStore((s) => s.dismissGoogleReconnect);
	const reconnectGoogle = useAuthStore((s) => s.reconnectGoogle);
	const [busy, setBusy] = useState(false);
	if (!needed) return null;

	const handleReconnect = async () => {
		setBusy(true);
		try {
			await reconnectGoogle(); // OAuth 리다이렉트 — 성공하면 페이지가 이동함
		} catch {
			setBusy(false);
		}
	};

	return (
		<div role="status" className="w-full bg-amber-500 text-amber-950 text-sm px-4 py-2 flex items-center justify-center gap-3 text-center">
			<span>{t("banner.google_reconnect")}</span>
			<button
				onClick={handleReconnect}
				disabled={busy}
				className="font-semibold underline underline-offset-4 disabled:opacity-60"
			>
				{t("banner.google_reconnect_button")}
			</button>
			<button onClick={dismiss} aria-label={t("common.close")} className="p-1 rounded hover:bg-amber-600/30">
				<X size={14} />
			</button>
		</div>
	);
};

export default GoogleReconnectBanner;
