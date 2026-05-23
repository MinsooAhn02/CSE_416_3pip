import toast from "react-hot-toast";
import i18n from "../l10n/i18n";

export const ErrorType = {
	TIMEOUT: "timeout",
	NETWORK: "network",
	HTTP_4XX: "http_4xx",
	HTTP_5XX: "http_5xx",
	UNKNOWN: "unknown",
};

export const classifyApiError = (err, httpStatus = null) => {
	if (httpStatus != null) {
		if (httpStatus >= 400 && httpStatus < 500) return ErrorType.HTTP_4XX;
		if (httpStatus >= 500) return ErrorType.HTTP_5XX;
	}
	if (err?.name === "AbortError") return ErrorType.TIMEOUT;
	const msg = String(err?.message || "").toLowerCase();
	if (msg.includes("timeout")) return ErrorType.TIMEOUT;
	if (
		err?.name === "TypeError" ||
		msg.includes("failed to fetch") ||
		msg.includes("networkerror")
	)
		return ErrorType.NETWORK;
	return ErrorType.UNKNOWN;
};

// userVisible: true  → toast for timeout/network + console.warn
// userVisible: false → console.warn only (default, silent for user)
export const handleApiError = (
	err,
	context = "",
	{ userVisible = false, httpStatus = null } = {},
) => {
	const type = classifyApiError(err, httpStatus);
	console.warn(`[${context}] ${type}: ${err?.message || String(err) || "unknown"}`);

	if (!userVisible) return type;

	const isKo = String(i18n?.language || "").toLowerCase().startsWith("ko");

	if (type === ErrorType.TIMEOUT) {
		toast.error(
			isKo ? "잠시 후 다시 시도해 주세요." : "Please try again in a moment.",
			{ id: "api-timeout", duration: 3000 },
		);
	} else if (type === ErrorType.NETWORK) {
		toast.error(
			isKo
				? "네트워크 연결을 확인해 주세요."
				: "Check your network connection.",
			{ id: "api-network", duration: 3000 },
		);
	}

	return type;
};
