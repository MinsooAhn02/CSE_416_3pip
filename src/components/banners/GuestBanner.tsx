import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";
import { isGuest } from "../../lib/guest";

/** 둘러보기 모드 안내 — 샘플 데이터임을 알리고 실제 로그인으로 유도 */
const GuestBanner = () => {
	const { t } = useTranslation();
	const login = useAuthStore((s) => s.login);
	if (!isGuest()) return null;

	return (
		<div className="w-full bg-blue-600 text-white text-sm px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
			<span>{t("guest.banner")}</span>
			<button
				onClick={() => login()}
				className="font-semibold underline underline-offset-4 hover:text-blue-100"
			>
				{t("guest.sign_in")}
			</button>
		</div>
	);
};

export default GuestBanner;
