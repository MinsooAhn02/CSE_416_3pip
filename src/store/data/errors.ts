import i18n from "../../l10n/i18n";

export const resolveAppLanguage = (value = i18n.language): string =>
	String(value || "en").toLowerCase().startsWith("ko") ? "ko" : "en";

export const getI18nText = (key: string, options: Record<string, unknown>, fallback: string): string => {
	const translated = i18n.t(key, options);
	return translated && translated !== key ? translated : fallback;
};

export const getErrorText = (key: string, options: Record<string, unknown>, fallback: string): string =>
	getI18nText(`errors.${key}`, options, fallback);

export const extractEdgeErrorMessage = (raw: unknown): string => {
	const text = String(raw || "").trim();
	if (!text) return "";

	const jsonMatch = text.match(/\{[\s\S]*\}$/);
	if (jsonMatch) {
		try {
			const parsed: unknown = JSON.parse(jsonMatch[0]);
			if (parsed && typeof parsed === "object") {
				const p = parsed as Record<string, unknown>;
				if (typeof p?.error === "string" && p.error.trim()) {
					return p.error.trim();
				}
				if (typeof p?.message === "string" && p.message.trim()) {
					return p.message.trim();
				}
			}
		} catch {
			/* ignore */
		}
	}

	return text;
};

export const getTavilyErrorMessage = (raw: unknown): string => {
	const message = extractEdgeErrorMessage(raw);
	const normalized = message.toLowerCase();

	if (!message) {
		return getErrorText(
			"connection_failed",
			{},
			"Connection failed. Please try again later.",
		);
	}
	if (normalized.includes("tavily_api_key not set")) {
		return getErrorText("tavily_no_key", {}, "Tavily API key is not configured in Supabase.");
	}
	if (normalized.includes("tavily 401") || normalized.includes("tavily 403")) {
		return getErrorText("tavily_rejected", {}, "Tavily request was rejected. Check the API key and permissions.");
	}
	if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
		return getErrorText(
			"network_error",
			{},
			"Network error. Please try again.",
		);
	}
	return message;
};
