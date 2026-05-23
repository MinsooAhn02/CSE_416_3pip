import toast from "react-hot-toast";
import i18n from "../l10n/i18n";

export const ErrorType = {
	TIMEOUT: "timeout",
	NETWORK: "network",
	HTTP_4XX: "http_4xx",
	HTTP_5XX: "http_5xx",
	UNKNOWN: "unknown",
} as const;

export type ErrorTypeValue = (typeof ErrorType)[keyof typeof ErrorType];

export const classifyApiError = (
	err: unknown,
	httpStatus: number | null = null,
): ErrorTypeValue => {
	if (httpStatus != null) {
		if (httpStatus >= 400 && httpStatus < 500) return ErrorType.HTTP_4XX;
		if (httpStatus >= 500) return ErrorType.HTTP_5XX;
	}
	const e = err as Record<string, unknown> | null;
	if (e?.name === "AbortError") return ErrorType.TIMEOUT;
	const msg = String((e?.message as string) || "").toLowerCase();
	if (msg.includes("timeout")) return ErrorType.TIMEOUT;
	if (
		e?.name === "TypeError" ||
		msg.includes("failed to fetch") ||
		msg.includes("networkerror")
	)
		return ErrorType.NETWORK;
	return ErrorType.UNKNOWN;
};

export const handleApiError = (
	err: unknown,
	context = "",
	{ userVisible = false, httpStatus = null as number | null } = {},
): ErrorTypeValue => {
	const type = classifyApiError(err, httpStatus);
	const e = err as Record<string, unknown> | null;
	console.warn(`[${context}] ${type}: ${(e?.message as string) || String(err) || "unknown"}`);

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
