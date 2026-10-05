import { getErrorText } from "./errors";
import { WeatherData, StockItem, HealthData } from "./types";

export const extractLayoutWidgetIds = (layouts: unknown): Set<string> => {
	if (!layouts || typeof layouts !== "object") return new Set();
	const ids = new Set<string>();
	for (const key of Object.keys(layouts as Record<string, unknown>)) {
		const bpLayout = (layouts as Record<string, unknown>)[key];
		if (!Array.isArray(bpLayout)) continue;
		for (const item of bpLayout as { i?: string }[]) {
			if (item?.i) ids.add(item.i);
		}
	}
	return ids;
};

export const defaultStockSymbols = ["KOSPI", "NASDAQ", "SP500", "USDKRW"];
export const STOCK_SYMBOL_ALIAS_MAP: Record<string, string> = {
	KOSPI: "KOSPI",
	KS11: "KOSPI",
	"^KOSPI": "KOSPI",
	"^KS11": "KOSPI",
	NASDAQ: "NASDAQ",
	IXIC: "NASDAQ",
	"^IXIC": "NASDAQ",
	SP500: "SP500",
	"SP 500": "SP500",
	"S&P500": "SP500",
	"S&P 500": "SP500",
	SPX: "SP500",
	"^SPX": "SP500",
	USDKRW: "USDKRW",
	"USD/KRW": "USDKRW",
	"USD-KRW": "USDKRW",
};

export const normalizeStockSymbols = (symbols: unknown[]): string[] => {
	if (!Array.isArray(symbols) || symbols.length === 0)
		return defaultStockSymbols;
	const unique = Array.from(
		new Set(
			symbols
				.map((s) =>
					String(s || "")
						.trim()
						.toUpperCase(),
				)
				.map((s) => STOCK_SYMBOL_ALIAS_MAP[s] ?? s)
				.filter(Boolean),
		),
	);
	if (unique.length === 0) return defaultStockSymbols;
	return unique;
};


export const numberFormatter = new Intl.NumberFormat("ko-KR", {
	maximumFractionDigits: 2,
});

/* ── 날씨: Groq LLM 추정 (유일한 소스) ── */
export const normalizeGroqWeather = (payload: unknown): WeatherData | null => {
	if (!payload || typeof payload !== "object") return null;
	const p = payload as Record<string, unknown>;
	const temp = Number(p.temp);
	const humidity = Number(p.humidity);
	const precipitation = Number(p.precipitation);
	const airQualityIndex = typeof p.airQualityIndex === "number" ? p.airQualityIndex : undefined;
	const conditionId = typeof p.conditionId === "number" ? p.conditionId : undefined;
	return {
		temp: Number.isFinite(temp) ? temp : 20,
		city: String(p.city || "Seoul"),
		condition: String(p.condition || p.description || "N/A"),
		conditionId,
		precipitation: Number.isFinite(precipitation) ? precipitation : 0,
		airQuality: p.airQuality ? String(p.airQuality) : undefined,
		airQualityIndex,
		humidity: Number.isFinite(humidity) ? humidity : 50,
	};
};

/* ── 주식 정규화 ── */
export const toTwoDecimalPercentString = (value: unknown): string | null => {
	const cleaned = String(value ?? "")
		.replace(/,/g, "")
		.replace(/%/g, "")
		.trim();
	const n = Number(cleaned);
	if (!Number.isFinite(n)) return null;
	return `${n.toFixed(2)}%`;
};

export const toStockDisplayValue = (value: unknown): string => {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return "--";
	return numberFormatter.format(n);
};

export interface RawStockRow {
	symbol?: string;
	name?: string;
	value?: string | number;
	change?: string | number;
	up?: boolean;
	type?: string;
	currency?: string;
	price?: number;
	changePercent?: string | number;
}

export const normalizeStockItem = (item: unknown): StockItem | null => {
	if (!item) return null;
	const row = item as RawStockRow;
	if ("name" in row && "value" in row) {
		// Cached item — backfill symbol if missing (old cache format)
		const normalizedChange = toTwoDecimalPercentString(row.change);
		const normalizedValue = toStockDisplayValue(
			typeof row.value === "string"
				? row.value.replace(/[^0-9.\-]/g, "")
				: row.value,
		);
		const baseItem =
			normalizedChange != null ? { ...row, change: normalizedChange } : row;
		const normalizedItem = { ...baseItem, value: normalizedValue };
		if (!("symbol" in row)) {
			return {
				...normalizedItem,
				symbol: row.name === "S&P 500" ? "SP500" : (row.name ?? ""),
				name: row.name ?? "",
				value: normalizedValue,
				change: normalizedChange ?? String(row.change ?? ""),
				up: row.up ?? false,
			} as StockItem;
		}
		return normalizedItem as StockItem;
	}

	const numericChange = Number(row.change ?? 0);
	const numericPrice = Number(row.price ?? 0);
	const normalizedPercent = toTwoDecimalPercentString(row.changePercent);

	return {
		symbol: row.symbol ?? "",
		name: row.symbol === "SP500" ? "S&P 500" :
			row.symbol === "CRUDE" ? "WTI Crude" :
			row.symbol === "DXY" ? "Dollar Index" :
			row.symbol === "DJI" ? "Dow Jones" :
			(row.symbol ?? ""),
		value: toStockDisplayValue(numericPrice),
		change:
			normalizedPercent ??
			`${numericChange >= 0 ? "+" : ""}${numberFormatter.format(numericChange)}`,
		up: numericChange >= 0,
		...(row.type != null && { type: row.type }),
		...(row.currency != null && { currency: row.currency }),
	};
};

export const hasMeaningfulStockValues = (rows: unknown[]): boolean => {
	if (!Array.isArray(rows) || rows.length === 0) return false;
	return rows.some((row) => {
		const r = row as RawStockRow | null;
		// Raw edge 응답은 { price: number } 형태
		const rawPrice = Number(r?.price ?? 0);
		if (rawPrice > 0) return true;
		// normalizeStockItem 통과 후 캐시에 저장된 형태는 { value: "1,234.56" }
		// → 여기도 인식하지 못하면 주식 DB 캐시가 항상 bypass 되어
		//   매번 API를 두드림 (과거 latent 버그).
		const v = r?.value;
		if (typeof v !== "string") return false;
		const parsed = Number(v.replace(/[^0-9.\-]/g, ""));
		return Number.isFinite(parsed) && parsed > 0;
	});
};

export const getStockSymbolKey = (row: unknown): string => {
	const r = row as RawStockRow | null;
	const upper = String(r?.symbol ?? r?.name ?? "")
		.trim()
		.toUpperCase();
	if (!upper) return "";
	return STOCK_SYMBOL_ALIAS_MAP[upper] ?? upper;
};

export const getStockRowNumericValue = (row: unknown): number => {
	const r = row as RawStockRow | null;
	const rawPrice = Number(r?.price ?? 0);
	if (Number.isFinite(rawPrice) && rawPrice > 0) return rawPrice;
	const v = r?.value;
	if (typeof v !== "string") return 0;
	const parsed = Number(v.replace(/[^0-9.\-]/g, ""));
	return Number.isFinite(parsed) ? parsed : 0;
};

export const pickBestStockRowsForSymbols = (symbols: unknown[], ...sources: unknown[][]): unknown[] => {
	const normalizedSymbols = normalizeStockSymbols(symbols);
	const bestByKey = new Map<string, unknown>();

	for (const source of sources) {
		const rows = Array.isArray(source) ? source : [];
		for (const row of rows) {
			const key = getStockSymbolKey(row);
			if (!key) continue;
			const current = bestByKey.get(key);
			const currentValue = getStockRowNumericValue(current);
			const incomingValue = getStockRowNumericValue(row);
			if (!current || (incomingValue > 0 && currentValue <= 0)) {
				bestByKey.set(key, row);
			}
		}
	}

	return normalizedSymbols
		.map((symbol) => bestByKey.get(symbol))
		.filter((row): row is unknown => row !== undefined);
};

/* ── 건강 데이터 정규화: Steps + Sleep 유효 필터링 ── */
export const normalizeHealthData = (raw: unknown): HealthData | null => {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	return {
		steps: Number(r.steps) || 0,
		stepsGoal: 10000,
		sleep: Number(r.sleep) || 0,
		sleepGoal: 8,
		calories: Number(r.calories) || 0,
		caloriesGoal: 2200,
		heartRate: Number(r.heartRate) || 0,
		water: 0,
		waterGoal: 8,
	};
};

export const isGoogleHealthAuthErrorMessage = (message = ""): boolean => {
	const normalized = String(message || "").toLowerCase();
	return (
		normalized.includes("google oauth token required") ||
		normalized.includes("unauthorized") ||
		normalized.includes("access token") ||
		normalized.includes("permission") ||
		normalized.includes("insufficient") ||
		normalized.includes("401")
	);
};

export const isGoogleHealthApiDisabledMessage = (message = ""): boolean => {
	const normalized = String(message || "").toLowerCase();
	return (
		normalized.includes("accessnotconfigured") ||
		normalized.includes("service_disabled") ||
		normalized.includes("fitness api has not been used") ||
		normalized.includes("google fit 403") ||
		normalized.includes("google fit api has not been used")
	);
};

export const getGoogleHealthErrorMessage = (message = ""): string => {
	if (isGoogleHealthApiDisabledMessage(message)) {
		return getErrorText(
			"google_health_api_disabled",
			{},
			"Google Fitness API is disabled for this Google Cloud project. Enable it in Google Cloud, wait a few minutes, then reconnect Google.",
		);
	}
	if (isGoogleHealthAuthErrorMessage(message)) {
		return getErrorText(
			"google_health_auth",
			{},
			"Google Health connection expired. Reconnect Google to sync Health again.",
		);
	}
	return (
		message ||
		getErrorText("load_error", {}, "Failed to load Google Health data.")
	);
};
