import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import { MIN_PASSPHRASE_LENGTH } from "../../lib/diaryCrypto";
import ConfirmDialog from "./ConfirmDialog";
import DiaryUnlock from "./DiaryUnlock";

// 설정 > 일기: 종단간 암호화 섹션
const DiaryEncryptionSettings = () => {
	const { t } = useTranslation();
	const { isDark, muted, inputCls } = useTheme();
	const {
		encryptionStatus,
		enableDiaryEncryption,
		disableDiaryEncryption,
		forgetDiaryKeyOnThisDevice,
	} = useDiaryStore(
		useShallow((s) => ({
			encryptionStatus: s.encryptionStatus,
			enableDiaryEncryption: s.enableDiaryEncryption,
			disableDiaryEncryption: s.disableDiaryEncryption,
			forgetDiaryKeyOnThisDevice: s.forgetDiaryKeyOnThisDevice,
		})),
	);
	const [pass, setPass] = useState("");
	const [confirm, setConfirm] = useState("");
	const [ack, setAck] = useState(false);
	const [busy, setBusy] = useState<"enable" | "disable" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState<"forget" | "disable" | null>(null);

	const tooShort = pass.length > 0 && pass.length < MIN_PASSPHRASE_LENGTH;
	const mismatch = confirm.length > 0 && pass !== confirm;
	const valid = pass.length >= MIN_PASSPHRASE_LENGTH && pass === confirm && ack;

	const run = async (kind: "enable" | "disable" | "forget", fn: () => Promise<void>) => {
		setError(null);
		if (kind !== "forget") setBusy(kind);
		try {
			await fn();
			setPass("");
			setConfirm("");
			setAck(false);
		} catch (err) {
			console.error("Diary encryption action failed:", err);
			// 스토어 오류 코드(영문)는 그대로 보여주지 않음 — 짧은 비밀번호만 별도 안내
			setError(
				err instanceof Error && err.message === "passphrase_too_short"
					? t("diary_encryption.passphrase_hint", { min: MIN_PASSPHRASE_LENGTH })
					: t("diary_encryption.error_generic"),
			);
		} finally {
			setBusy(null);
		}
	};

	const btn = `px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
		isDark ? "border-white/15 bg-white/5 hover:bg-white/10" : "border-gray-200 bg-white hover:bg-gray-50"
	}`;

	return (
		<div
			className={`p-4 rounded-xl border space-y-3 ${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"}`}
		>
			<div className="flex items-start gap-3">
				<div className={`p-2 rounded-lg ${isDark ? "bg-blue-500/15" : "bg-blue-100"}`}>
					<ShieldCheck size={18} className="text-blue-500" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium">{t("diary_encryption.title")}</p>
					<p className={`text-xs mt-1 ${muted}`}>
						{encryptionStatus === "off"
							? t("diary_encryption.intro")
							: encryptionStatus === "unlocked"
								? t("diary_encryption.on_title")
								: t("diary_encryption.locked_title")}
					</p>
				</div>
			</div>

			{encryptionStatus === "off" && (
				<form
					className="space-y-3"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid && !busy) void run("enable", () => enableDiaryEncryption(pass));
					}}
				>
					<p className={`text-xs ${muted}`}>{t("diary_encryption.intro_ai")}</p>
					<p className={`text-xs ${muted}`}>{t("diary_encryption.intro_pin")}</p>
					<input
						type="password"
						autoComplete="new-password"
						value={pass}
						onChange={(e) => setPass(e.target.value)}
						placeholder={t("diary_encryption.passphrase")}
						aria-label={t("diary_encryption.passphrase")}
						disabled={!!busy}
						className={`w-full rounded-lg px-3 py-2 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
					/>
					<input
						type="password"
						autoComplete="new-password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						placeholder={t("diary_encryption.passphrase_confirm")}
						aria-label={t("diary_encryption.passphrase_confirm")}
						disabled={!!busy}
						className={`w-full rounded-lg px-3 py-2 text-sm outline-none border focus:border-blue-400 ${inputCls}`}
					/>
					<p className={`text-xs ${tooShort ? "text-red-400" : muted}`}>
						{t("diary_encryption.passphrase_hint", { min: MIN_PASSPHRASE_LENGTH })}
					</p>
					{mismatch && <p className="text-xs text-red-400">{t("diary_encryption.mismatch")}</p>}
					<label className="flex items-start gap-2 text-xs cursor-pointer">
						<input
							type="checkbox"
							checked={ack}
							onChange={(e) => setAck(e.target.checked)}
							disabled={!!busy}
							className="mt-0.5"
						/>
						<span>{t("diary_encryption.ack")}</span>
					</label>
					<button
						type="submit"
						disabled={!valid || !!busy}
						className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{busy === "enable" ? t("diary_encryption.enabling") : t("diary_encryption.enable")}
					</button>
					{busy === "enable" && (
						<p role="status" className={`text-xs ${muted}`}>
							{t("diary_encryption.enabling_hint")}
						</p>
					)}
				</form>
			)}

			{encryptionStatus === "unlocked" && (
				<div className="space-y-3">
					<p className={`text-xs ${muted}`}>{t("diary_encryption.on_desc")}</p>
					<div className="flex flex-wrap gap-2">
						<button type="button" disabled={!!busy} onClick={() => setPending("forget")} className={btn}>
							{t("diary_encryption.forget_key")}
						</button>
						<button
							type="button"
							disabled={!!busy}
							onClick={() => setPending("disable")}
							className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
								isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 text-red-500 hover:bg-red-100"
							}`}
						>
							{busy === "disable" ? t("diary_encryption.disabling") : t("diary_encryption.disable")}
						</button>
					</div>
				</div>
			)}

			{encryptionStatus === "locked" && (
				<>
					<p className={`text-xs ${muted}`}>{t("diary_encryption.locked_desc")}</p>
					<DiaryUnlock />
				</>
			)}

			{error && (
				<p role="alert" className="text-xs text-red-400">
					{error}
				</p>
			)}

			{pending === "forget" && (
				<ConfirmDialog
					title={t("diary_encryption.forget_title")}
					message={t("diary_encryption.forget_message")}
					confirmLabel={t("diary_encryption.forget_key")}
					danger={false}
					onConfirm={() => {
						setPending(null);
						void run("forget", forgetDiaryKeyOnThisDevice);
					}}
					onCancel={() => setPending(null)}
				/>
			)}
			{pending === "disable" && (
				<ConfirmDialog
					title={t("diary_encryption.disable_title")}
					message={t("diary_encryption.disable_message")}
					confirmLabel={t("diary_encryption.disable")}
					onConfirm={() => {
						setPending(null);
						void run("disable", disableDiaryEncryption);
					}}
					onCancel={() => setPending(null)}
				/>
			)}
		</div>
	);
};

export default DiaryEncryptionSettings;
