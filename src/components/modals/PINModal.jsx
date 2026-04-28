import { useEffect, useMemo, useState } from "react";
import { X, Lock, AlertCircle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";
import {
	DEFAULT_PIN_LOCK_MODE,
	useSettingsStore,
} from "../../store/useSettingsStore";

const MaskedPinField = ({
	label,
	value,
	onChange,
	disabled,
	autoFocus = false,
	inputCls,
	isDark,
}) => (
	<div>
		<label
			className={`text-xs font-medium block mb-2 ${isDark ? "opacity-70" : "text-gray-600"}`}
		>
			{label}
		</label>
		<div
			className={`relative rounded-lg border transition-all focus-within:ring-2 focus-within:ring-blue-500/30 ${inputCls}`}
		>
			<input
				type="text"
				inputMode="numeric"
				autoComplete="one-time-code"
				maxLength="4"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="absolute inset-0 h-full w-full opacity-0"
				disabled={disabled}
				autoFocus={autoFocus}
				aria-label={label}
			/>
			<div className="grid grid-cols-4 gap-2 p-3 pointer-events-none">
				{Array.from({ length: 4 }).map((_, index) => (
					<div
						key={`${label}-${index}`}
						className={`h-12 rounded-md flex items-center justify-center text-2xl font-mono font-bold ${
							isDark ? "bg-white/5 text-white" : "bg-white text-gray-900"
						}`}
					>
						{index < value.length ? "*" : ""}
					</div>
				))}
			</div>
		</div>
		<p
			className={`text-xs mt-1 ${value.length === 4 ? "text-green-500" : isDark ? "text-gray-500" : "text-gray-400"}`}
		>
			{value.length}/4 digits
		</p>
	</div>
);

/**
 * PINModal - Handles diary PIN setup, verification, and change flows.
 * @param {{
 *   onSuccess: () => void,
 *   onCancel?: () => void,
 *   mode?: "setup" | "verify" | "change" | "disable"
 * }} props
 */
const PINModal = ({ onSuccess, onCancel, mode = "verify" }) => {
	const { isDark, cardCls, inputCls, hoverCls, secondaryBgCls } = useTheme();
	const { setPIN, verifyPIN, pinSet, resetPIN, setPinModalVisible } =
		useDiaryStore();
	const pinLockMode = useSettingsStore((state) => state.pinLockMode);
	const setPinLockMode = useSettingsStore((state) => state.setPinLockMode);

	const [pin, setPin] = useState("");
	const [confirmPin, setConfirmPin] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [stage, setStage] = useState(
		mode === "change" || mode === "disable" ? "verify-current" : mode,
	);

	useEffect(() => {
		if (!pinSet && mode === "verify") {
			setStage("setup");
		} else if (mode === "change" || mode === "disable") {
			setStage("verify-current");
		} else {
			setStage(mode);
		}
		setPin("");
		setConfirmPin("");
		setError("");
	}, [mode, pinSet]);

	useEffect(() => {
		setPinModalVisible(true);
		return () => setPinModalVisible(false);
	}, [setPinModalVisible]);

	const isSetupStage = stage === "setup" || stage === "change-setup";

	const modalCopy = useMemo(() => {
		if (stage === "verify-current") {
			if (mode === "disable") {
				return {
					title: "Disable PIN",
					description: "Enter your current 4-digit PIN to turn diary protection off.",
					primaryLabel: "Disable PIN",
					inputLabel: "Current PIN",
					footer: "Your current PIN is required before diary protection can be disabled.",
				};
			}

			return {
				title: "Change PIN",
				description: "Enter your current 4-digit PIN first.",
				primaryLabel: "Next",
				inputLabel: "Current PIN",
				footer: "You need your current PIN before choosing a new one.",
			};
		}

		if (stage === "change-setup") {
			return {
				title: "Set New PIN",
				description: "Choose a new 4-digit PIN for your diary.",
				primaryLabel: "Change PIN",
				inputLabel: "New PIN",
				footer: "Your new PIN will be used the next time you unlock the diary.",
			};
		}

		if (stage === "setup") {
			return {
				title: "Set Up Diary PIN",
				description: "Set a 4-digit PIN if you want to protect diary content.",
				primaryLabel: "Set PIN",
				inputLabel: "Create PIN",
				footer: "You can change this PIN later in Settings.",
			};
		}

		return {
			title: "Verify PIN",
			description: "Enter your 4-digit PIN to access diary content.",
			primaryLabel: "Unlock",
			inputLabel: "Enter PIN",
			footer: "Your PIN protects sensitive diary content.",
		};
	}, [mode, stage]);

	const handlePinChange = (value) => {
		setPin(value.replace(/\D/g, "").slice(0, 4));
	};

	const handleConfirmPinChange = (value) => {
		setConfirmPin(value.replace(/\D/g, "").slice(0, 4));
	};

	const validateSetup = () => {
		if (pin.length !== 4) {
			setError("PIN must be exactly 4 digits");
			return false;
		}

		if (pin !== confirmPin) {
			setError("PINs do not match");
			setPin("");
			setConfirmPin("");
			return false;
		}

		return true;
	};

	const finishSetup = () => {
		setPIN(pin);
		if (pinLockMode === "off") {
			setPinLockMode(DEFAULT_PIN_LOCK_MODE);
		}
		verifyPIN(pin);
		onSuccess();
	};

	const handleSubmit = async () => {
		setError("");

		if (stage === "setup" || stage === "change-setup") {
			if (!validateSetup()) return;

			setIsLoading(true);
			try {
				finishSetup();
			} catch (err) {
				setError(err?.message || "Failed to save PIN");
			} finally {
				setIsLoading(false);
			}
			return;
		}

		if (pin.length !== 4) {
			setError("PIN must be exactly 4 digits");
			return;
		}

		setIsLoading(true);
		try {
			const isCorrect = verifyPIN(pin);
			if (!isCorrect) {
				setError("Incorrect PIN");
				setPin("");
				return;
			}

			if (stage === "verify-current") {
				if (mode === "disable") {
					setPinLockMode("off");
					resetPIN();
					onSuccess();
					return;
				}

				setStage("change-setup");
				setPin("");
				setConfirmPin("");
				return;
			}

			onSuccess();
		} catch (err) {
			setError(err?.message || "Failed to verify PIN");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const handleKeyPress = (e) => {
			if (e.key !== "Enter") return;
			if (isSetupStage && confirmPin.length !== 4) return;
			if (pin.length !== 4) return;
			handleSubmit();
		};

		document.addEventListener("keydown", handleKeyPress);
		return () => document.removeEventListener("keydown", handleKeyPress);
	}, [confirmPin.length, isSetupStage, pin.length, stage]);

	return (
		<div
			className="fixed inset-0 z-[21000] flex items-center justify-center p-4"
			onClick={onCancel}
		>
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

			<div
				className={`relative z-10 w-full max-w-sm rounded-2xl border shadow-2xl p-6 flex flex-col gap-4 ${cardCls}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center gap-3">
					<div
						className={`p-2 rounded-lg ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}
					>
						<Lock size={20} className="text-blue-500" />
					</div>
					<div>
						<h2 className="font-bold text-lg">{modalCopy.title}</h2>
						<p
							className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
						>
							{modalCopy.description}
						</p>
					</div>
					{onCancel && (
						<button
							onClick={onCancel}
							className={`ml-auto p-1 rounded-full transition-colors ${hoverCls}`}
						>
							<X size={18} />
						</button>
					)}
				</div>

				<div className="space-y-4">
					<MaskedPinField
						label={modalCopy.inputLabel}
						value={pin}
						onChange={handlePinChange}
						disabled={isLoading}
						autoFocus
						inputCls={inputCls}
						isDark={isDark}
					/>

					{isSetupStage && (
						<MaskedPinField
							label="Confirm PIN"
							value={confirmPin}
							onChange={handleConfirmPinChange}
							disabled={isLoading}
							inputCls={inputCls}
							isDark={isDark}
						/>
					)}

					{error && (
						<div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
							<AlertCircle
								size={16}
								className="text-red-500 mt-0.5 flex-shrink-0"
							/>
							<p className="text-xs text-red-500">{error}</p>
						</div>
					)}

					<button
						onClick={handleSubmit}
						disabled={
							isLoading ||
							pin.length !== 4 ||
							(isSetupStage && confirmPin.length !== 4)
						}
						className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
							isLoading ||
							pin.length !== 4 ||
							(isSetupStage && confirmPin.length !== 4)
								? `${secondaryBgCls} text-morning-dark-muted cursor-not-allowed`
								: `${isDark ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`
						}`}
					>
						{isLoading ? (
							<>
								<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
								Working...
							</>
						) : (
							modalCopy.primaryLabel
						)}
					</button>
				</div>

				<p
					className={`text-xs text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}
				>
					{modalCopy.footer}
				</p>
			</div>
		</div>
	);
};

export default PINModal;
