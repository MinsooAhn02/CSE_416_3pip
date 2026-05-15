import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const ZERO = { price: 0, change: 0, changePercent: "0%" };
const TWELVEDATA_TIMEOUT_MS = 3200;
const YAHOO_TIMEOUT_MS = 3200;
const STOOQ_TIMEOUT_MS = 2600;
const FX_FALLBACK_TIMEOUT_MS = 4500;

async function fetchJsonWithTimeout(url: string, timeoutMs = 7000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

async function fetchTextWithTimeout(url: string, timeoutMs = 5000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.text();
	} finally {
		clearTimeout(timer);
	}
}

function isTwelveError(payload: any) {
	return Boolean(
		payload?.code || payload?.status === "error" || payload?.message,
	);
}

const yahooSymbolMap: Record<string, string> = {
	KS11: "^KS11",
	IXIC: "^IXIC",
	SPX: "^GSPC",
	EWY: "EWY",
	QQQ: "QQQ",
	SPY: "SPY",
	"USD/KRW": "KRW=X",
};

async function fetchYahooQuote(
	alphaSymbol: string,
): Promise<{ price: number; change: number; changePercent: string } | null> {
	const primary = yahooSymbolMap[alphaSymbol] ?? alphaSymbol;
	// For unknown symbols, also try the ^PREFIX variant that Yahoo uses for indices.
	const candidates: string[] = [primary];
	if (!primary.startsWith("^") && !(alphaSymbol in yahooSymbolMap)) {
		candidates.push(`^${alphaSymbol}`);
	}

	for (const candidate of [...new Set(candidates)]) {
		try {
			const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(candidate)}`;
			const data = await fetchJsonWithTimeout(url, YAHOO_TIMEOUT_MS);
			const quote = data?.quoteResponse?.result?.[0];
			const price = Number(quote?.regularMarketPrice ?? quote?.postMarketPrice ?? 0);
			if (!Number.isFinite(price) || price <= 0) continue;

			const change = Number(quote?.regularMarketChange ?? 0);
			const changePercentRaw = Number(quote?.regularMarketChangePercent);
			const changePercent = Number.isFinite(changePercentRaw)
				? toPercentString(changePercentRaw)
				: toPercentString(change);

			return {
				price,
				change: Number.isFinite(change) ? change : 0,
				changePercent,
			};
		} catch {
			continue;
		}
	}
	return null;
}

async function fetchStooqPrice(alphaSymbol: string): Promise<number | null> {
	const map: Record<string, string[]> = {
		KS11: ["^kospi", "^ks11", "ks11"], // ^ks11 is often N/D on Stooq; ^kospi is reliable
		IXIC: ["^ndq"], // NASDAQ Composite
		SPX: ["^spx"], // S&P 500
		EWY: ["ewy.us"],
		QQQ: ["qqq.us"],
		SPY: ["spy.us"],
	};
	const sym = alphaSymbol.toLowerCase();
	const candidates = map[alphaSymbol]
		? map[alphaSymbol]
		: [`${sym}.us`, `^${sym}`, sym]; // US exchange → index prefix → bare symbol
	for (const stooqSymbol of candidates) {
		const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`;
		try {
			const csv = await fetchTextWithTimeout(url, STOOQ_TIMEOUT_MS);
			const lines = csv.trim().split("\n");
			if (lines.length < 2) continue;
			const row = lines[1].split(",");
			const close = parseFloat(row[6]);
			if (Number.isFinite(close) && close > 0) return close;
		} catch {
			continue;
		}
	}
	return null;
}

async function fetchUsdKrwFallback(): Promise<number | null> {
	const data = await fetchJsonWithTimeout(
		"https://open.er-api.com/v6/latest/USD",
		FX_FALLBACK_TIMEOUT_MS,
	);
	const rate = Number(data?.rates?.KRW);
	if (!Number.isFinite(rate) || rate <= 0) return null;
	return rate;
}

const toPercentString = (value: unknown) => {
	const n = Number(value);
	if (!Number.isFinite(n)) return "0%";
	const rounded = Math.round(n * 100) / 100;
	const signed = rounded > 0 ? `+${rounded.toFixed(2)}` : `${rounded.toFixed(2)}`;
	return `${signed}%`;
};

const normalizePercent = (value: unknown, fallbackChange: unknown) => {
	if (typeof value === "string" && value.trim()) {
		return value.includes("%") ? value : `${value}%`;
	}
	return toPercentString(fallbackChange);
};

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const { symbols = ["KOSPI", "NASDAQ", "SP500", "USDKRW"] } =
			await req.json();
		const apiKey = Deno.env.get("TWELVEDATA_API_KEY")?.trim() ?? "";

		// Internal symbol mapping -> TwelveData symbols
		const symbolMap: Record<string, string> = {
			KOSPI:  "KS11",     // KOSPI Composite Index
			NASDAQ: "IXIC",     // NASDAQ Composite
			SP500:  "SPX",      // S&P 500 Index
			USDKRW: "USD/KRW",
		};

		const results = await Promise.all(
			symbols.map(async (sym: string) => {
				try {
					const tdSymbol = symbolMap[sym] || sym;

					// For forex
					if (sym === "USDKRW") {
						if (apiKey) {
							const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${encodeURIComponent(apiKey)}`;
							const data = await fetchJsonWithTimeout(url, TWELVEDATA_TIMEOUT_MS);
							if (!isTwelveError(data)) {
								const price = Number(data?.close ?? 0);
								const change = Number(data?.change ?? 0);
								const percent = normalizePercent(data?.percent_change, change);
								if (Number.isFinite(price) && price > 0) {
									return {
										symbol: sym,
										price,
										change: Number.isFinite(change) ? change : 0,
										changePercent: percent,
									};
								}
							}
						}
						const yahooFx = await fetchYahooQuote(tdSymbol).catch(() => null);
						if (yahooFx) {
							return { symbol: sym, ...yahooFx };
						}
						const fallback = await fetchUsdKrwFallback().catch(() => null);
						if (fallback) {
							return {
								symbol: sym,
								price: fallback,
								change: 0,
								changePercent: "0%",
							};
						}
						return { symbol: sym, ...ZERO };
					}

					// For stocks/ETFs (KS11 needs the exchange qualifier for TwelveData)
					if (apiKey) {
						const exchange = tdSymbol === "KS11" ? "&exchange=XKOS" : "";
						const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}${exchange}&apikey=${encodeURIComponent(apiKey)}`;
						const data = await fetchJsonWithTimeout(url, TWELVEDATA_TIMEOUT_MS);
						if (!isTwelveError(data)) {
							const price = Number(data?.close ?? 0);
							const change = Number(data?.change ?? 0);
							const percent = normalizePercent(data?.percent_change, change);
							if (Number.isFinite(price) && price > 0) {
								return {
									symbol: sym,
									price,
									change: Number.isFinite(change) ? change : 0,
									changePercent: percent,
								};
							}
						}
					}
					const yahooQuote = await fetchYahooQuote(tdSymbol).catch(() => null);
					if (yahooQuote) {
						return { symbol: sym, ...yahooQuote };
					}
					const fallbackPrice = await fetchStooqPrice(tdSymbol).catch(
						() => null,
					);
					if (fallbackPrice) {
						return {
							symbol: sym,
							price: fallbackPrice,
							change: 0,
							changePercent: "0%",
						};
					}
					return { symbol: sym, ...ZERO };
				} catch {
					return { symbol: sym, ...ZERO };
				}
			}),
		);

		return new Response(JSON.stringify(results), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
