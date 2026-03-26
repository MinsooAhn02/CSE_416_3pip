import { useState, useEffect } from "react";
import { X, Lock, AlertCircle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useDiaryStore } from "../../store/useDiaryStore";

/**
 * PINModal — 4-digit PIN entry and authentication
 * @param {{ onSuccess: () => void, onCancel?: () => void, isFirstTime?: boolean }} props
 */
const PINModal = ({ onSuccess, onCancel, isFirstTime = false }) => {
	const { isDark } = useTheme();
	const { verifyPIN, pinSet } = useDiaryStore();

	const [pin, setPin] = useState("");
	const [confirmPin, setConfirmPin] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [stage, setStage] = useState(isFirstTime && !pinSet ? "setup" : "verify");

	/* Handle PIN digit input */
	const handlePinChange = (value) => {
		const cleaned = value.replace(/\D/g, "").slice(0, 4);
		if (stage === "setup") {
			setPin(cleaned);
		} else {
			setPin(cleaned);
		}
	};

	const handleConfirmPinChange = (value) => {
		const cleaned = value.replace(/\D/g, "").slice(0, 4);
		setConfirmPin(cleaned);
	};

	/* Handle PIN submission */
	const handleSubmit = async () => {
		setError("");

		if (stage === "setup") {
			// First time PIN setup
			if (pin.length !== 4) {
				setError("PIN must be exactly 4 digits");
				return;
			}
			if (pin !== confirmPin) {
				setError("PINs do not match");
				return;
			}
			setIsLoading(true);
			try {
				useDiaryStore.getState().setPIN(pin);
				verifyPIN(pin);
				setIsLoading(false);
				onSuccess();
			} catch (err) {
				setError(err.message);
				setIsLoading(false);
			}
		} else {
			// Verify existing PIN
			if (pin.length !== 4) {
				setError("PIN must be exactly 4 digits");
				return;
			}
			setIsLoading(true);
			try {
				const isCorrect = verifyPIN(pin);
				setIsLoading(false);
				if (isCorrect) {
					onSuccess();
				} else {
					setError("Incorrect PIN");
					setPin("");
				}
			} catch (err) {
				setError(err.message);
				setIsLoading(false);
			}
		}
	};

	/* Handle Enter key */
	useEffect(() => {
		const handleKeyPress = (e) => {
			if (e.key === "Enter" && pin.length === 4) {
				if (stage === "setup" && confirmPin.length === 4) {
					handleSubmit();
				} else if (stage === "verify") {
					handleSubmit();
				}
			}
		};
		document.addEventListener("keydown", handleKeyPress);
		return () => document.removeEventListener("keydown", handleKeyPress);
	}, [pin, confirmPin, stage]);

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-4"
			onClick={onCancel}
		>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

			{/* Modal Content */}
			<div
				className={`relative z-10 w-full max-w-sm rounded-2xl border shadow-2xl p-6 flex flex-col gap-4 ${
					isDark
						? "bg-[#1e1e1e] border-[#3a3a3a] text-white"
						: "bg-white border-gray-200 text-slate-800"
				}`}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center gap-3">
					<div className={`p-2 rounded-lg ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}>
						<Lock size={20} className="text-blue-500" />
					</div>
					<div>
						<h2 className="font-bold text-lg">
							{stage === "setup" ? "Set up PIN" : "Verify PIN"}
						</h2>
						<p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
							{stage === "setup"
								? "Create a 4-digit PIN to protect your diary"
								: "Enter your 4-digit PIN to access diary"}
						</p>
					</div>
					{onCancel && (
						<button
							onClick={onCancel}
							className={`ml-auto p-1 rounded-full transition-colors ${
								isDark ? "hover:bg-[#353535]" : "hover:bg-gray-100"
							}`}
						>
							<X size={18} />
						</button>
					)}
				</div>

				{/* PIN Input */}
				<div className="space-y-4">
					{/* First PIN Input */}
					<div>
						<label className={`text-xs font-medium block mb-2 ${isDark ? "opacity-70" : "text-gray-600"}`}>
							{stage === "setup" ? "Create PIN" : "Enter PIN"}
						</label>
						<input
							type="text"
							inputMode="numeric"
							maxLength="4"
							placeholder="••••"
							value={pin}
							onChange={(e) => handlePinChange(e.target.value)}
							className={`w-full text-2xl text-center font-mono font-bold tracking-widest rounded-lg p-3 outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 ${
								isDark
									? "bg-[#2a2a2a] border-[#3a3a3a] text-white placeholder:text-neutral-600"
									: "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-gray-400"
							}`}
							disabled={isLoading}
							autoFocus
						/>
						<p className={`text-xs mt-1 ${pin.length === 4 ? "text-green-500" : isDark ? "text-gray-500" : "text-gray-400"}`}>
							{pin.length}/4 digits
						</p>
					</div>

					{/* Confirm PIN (Setup stage only) */}
					{stage === "setup" && (
						<div>
							<label className={`text-xs font-medium block mb-2 ${isDark ? "opacity-70" : "text-gray-600"}`}>
								Confirm PIN
							</label>
							<input
								type="text"
								inputMode="numeric"
								maxLength="4"
								placeholder="••••"
								value={confirmPin}
								onChange={(e) => handleConfirmPinChange(e.target.value)}
								className={`w-full text-2xl text-center font-mono font-bold tracking-widest rounded-lg p-3 outline-none border transition-all focus:ring-2 focus:ring-blue-500/30 ${
									isDark
										? "bg-[#2a2a2a] border-[#3a3a3a] text-white placeholder:text-neutral-600"
										: "bg-gray-50 border-gray-200 text-slate-800 placeholder:text-gray-400"
								}`}
								disabled={isLoading}
							/>
							<p className={`text-xs mt-1 ${confirmPin.length === 4 ? "text-green-500" : isDark ? "text-gray-500" : "text-gray-400"}`}>
								{confirmPin.length}/4 digits
							</p>
						</div>
					)}

					{/* Error Message */}
					{error && (
						<div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
							<AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
							<p className="text-xs text-red-500">{error}</p>
						</div>
					)}

					{/* Submit Button */}
					<button
						onClick={handleSubmit}
						disabled={
							isLoading ||
							pin.length !== 4 ||
							(stage === "setup" && confirmPin.length !== 4)
						}
						className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
							isLoading ||
							pin.length !== 4 ||
							(stage === "setup" && confirmPin.length !== 4)
								? `${isDark ? "bg-[#2a2a2a] text-gray-500" : "bg-gray-100 text-gray-400"} cursor-not-allowed`
								: `${isDark ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`
						}`}
					>
						{isLoading ? (
							<>
								<div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
								Verifying...
							</>
						) : (
							"Verify"
						)}
					</button>
				</div>

				{/* Footer Info */}
				<p className={`text-xs text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
					{stage === "setup"
						? "You can change your PIN later in settings"
						: "Your PIN protects sensitive diary content"}
				</p>
			</div>
		</div>
	);
};

export default PINModal;
