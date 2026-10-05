import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { WrongPassphraseError } from "../../lib/diaryCrypto";

// 암호화된 일기 잠금 해제 폼 (DiaryPanel / DiaryListModal / Settings 공용)
const DiaryUnlock = ({ className = "" }: { className?: string }) => {
	const { t } = useTranslation();
	const { isDark, inputCls } = useTheme();
	const unlockDiary = useDiaryStore((s) => s.unlockDiary);
	const [passphrase, setPassphrase] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!passphrase || busy) return;
		setBusy(true);
		setError(null);
		try {
			await unlockDiary(passphrase);
			setPassphrase("");
		} catch (err) {
			setError(
				err instanceof WrongPassphraseError
					? t("diary_encryption.wrong_passphrase")
					: t("diary_encryption.unlock_error"),
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<form onSubmit={submit} className={`space-y-3 ${className}`}>
			<div className="flex items-center gap-2">
				<KeyRound size={16} className={isDark ? "text-gray-500" : "text-gray-400"} />
				<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
					{t("diary_encryption.unlock_prompt")}
				</p>
			</div>
			<input
				type="password"
				autoComplete="current-password"
				value={passphrase}
				onChange={(e) => setPassphrase(e.target.value)}
				placeholder={t("diary_encryption.passphrase")}
				aria-label={t("diary_encryption.passphrase")}
				className={`w-full rounded-lg px-3 py-2 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
			/>
			{error && (
				<p role="alert" className="text-xs text-red-400">
					{error}
				</p>
			)}
			<button
				type="submit"
				disabled={!passphrase || busy}
				className="w-full rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{busy ? t("diary_encryption.unlocking") : t("diary_encryption.unlock")}
			</button>
		</form>
	);
};

export default DiaryUnlock;
