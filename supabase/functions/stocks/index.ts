import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const ZERO = { price: 0, change: 0, changePercent: "0%" };

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

function isTwelveError(payload: any) {
	return Boolean(
		payload?.code || payload?.status === "error" || payload?.message,
	);
}

async function fetchStooqPrice(alphaSymbol: string): Promise<number | null> {
	const map: Record<string, string> = {
		EWY: "ewy.us",
		QQQ: "qqq.us",
		SPY: "spy.us",
	};
	const stooqSymbol = map[alphaSymbol] ?? `${alphaSymbol.toLowerCase()}.us`;
	const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`;
	const res = await fetch(url);
	if (!res.ok) return null;
	const csv = await res.text();
	const lines = csv.trim().split("\n");
	if (lines.length < 2) return null;
	const row = lines[1].split(",");
	const close = parseFloat(row[6]);
	if (!Number.isFinite(close) || close <= 0) return null;
	return close;
}

async function fetchUsdKrwFallback(): Promise<number | null> {
	const data = await fetchJsonWithTimeout(
		"https://open.er-api.com/v6/latest/USD",
		7000,
	);
	const rate = Number(data?.rates?.KRW);
	if (!Number.isFinite(rate) || rate <= 0) return null;
	return rate;
}

const toPercentString = (value: unknown) => {
	const n = Number(value);
	if (!Number.isFinite(n)) return "0%";
	const signed = n > 0 ? `+${n}` : `${n}`;
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
		const apiKey = Deno.env.get("TWELVEDATA_API_KEY");
		if (!apiKey) throw new Error("TWELVEDATA_API_KEY not set");

		// Internal symbol mapping -> TwelveData symbols
		const symbolMap: Record<string, string> = {
			KOSPI: "EWY", // KOSPI proxy ETF
			NASDAQ: "QQQ",
			SP500: "SPY",
			USDKRW: "USD/KRW",
		};

		const results = await Promise.all(
			symbols.map(async (sym: string) => {
				try {
					const tdSymbol = symbolMap[sym] || sym;

					// For forex
					if (sym === "USDKRW") {
						const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${encodeURIComponent(apiKey)}`;
						const data = await fetchJsonWithTimeout(url, 7000);
						if (isTwelveError(data)) {
							const fallback = await fetchUsdKrwFallback().catch(() => null);
							if (!fallback) return { symbol: sym, ...ZERO };
							return {
								symbol: sym,
								price: fallback,
								change: 0,
								changePercent: "0%",
							};
						}
						const price = Number(data?.close ?? 0);
						const change = Number(data?.change ?? 0);
						const percent = normalizePercent(data?.percent_change, change);
						return {
							symbol: sym,
							price: Number.isFinite(price) ? price : 0,
							change: Number.isFinite(change) ? change : 0,
							changePercent: percent,
						};
					}

					// For stocks/ETFs
					const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${encodeURIComponent(apiKey)}`;
					const data = await fetchJsonWithTimeout(url, 7000);
					if (isTwelveError(data)) {
						const fallbackPrice = await fetchStooqPrice(tdSymbol).catch(
							() => null,
						);
						if (!fallbackPrice) return { symbol: sym, ...ZERO };
						return {
							symbol: sym,
							price: fallbackPrice,
							change: 0,
							changePercent: "0%",
						};
					}
					const price = Number(data?.close ?? 0);
					const change = Number(data?.change ?? 0);
					const percent = normalizePercent(data?.percent_change, change);

					return {
						symbol: sym,
						price: Number.isFinite(price) ? price : 0,
						change: Number.isFinite(change) ? change : 0,
						changePercent: percent,
					};
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
