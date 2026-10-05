import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rejectIfNoUser } from "../_shared/auth.ts";

const MAX_SYMBOLS = 30;
const SYMBOL_RE = /^[A-Za-z0-9^.\/=-]{1,15}$/;

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const ZERO = { price: 0, change: 0, changePercent: "0%" };
const TWELVEDATA_TIMEOUT_MS = 8000;
const YAHOO_TIMEOUT_MS = 8000;

// 지수/원자재는 TwelveData 무료 플랜에서 미지원(404) → Yahoo Finance에서 조회.
// 환율(USD/KRW)·개별주식은 TwelveData에서 정상 동작하므로 그대로 둔다.
const YAHOO_SYMBOL_MAP: Record<string, string> = {
	SP500:  "^GSPC",
	KOSPI:  "^KS11",
	NASDAQ: "^IXIC",
	VIX:    "^VIX",
	DJI:    "^DJI",
	DXY:    "DX-Y.NYB", // ^DXY는 Yahoo에서 죽은 데이터라 ICE Dollar Index 사용
	CRUDE:  "CL=F",
};

async function fetchJsonWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { ...init, signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

function isTwelveError(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") return true;
	const p = payload as Record<string, unknown>;
	if (p.status === "error") return true;
	if (typeof p.code === "number" && p.code >= 400) return true;
	return false;
}

const normalizeTwelveDataType = (type: string | undefined, symbol: string): string => {
	if (!type) return symbol.includes("/") ? "currency" : "unknown";
	const t = type.toLowerCase();
	if (t.includes("index")) return "index";
	if (t.includes("physical currency") || t.includes("currency")) return "currency";
	if (t.includes("etf")) return "etf";
	if (t.includes("common stock") || t.includes("equity")) return "stock";
	return "unknown";
};

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

// Yahoo Finance chart v8: meta.regularMarketPrice / chartPreviousClose 기반으로 일간 변동 계산
async function fetchYahooQuote(internalSymbol: string, yahooSymbol: string) {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
	const data = await fetchJsonWithTimeout(url, YAHOO_TIMEOUT_MS, {
		headers: { "User-Agent": "Mozilla/5.0" },
	});

	const result = (data as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })
		?.chart?.result?.[0];
	const meta = result?.meta ?? null;
	const currency = String(meta?.currency ?? "").toUpperCase();
	const type = internalSymbol === "CRUDE" ? "commodity" : "index";

	const price = Number(meta?.regularMarketPrice ?? 0);
	if (!meta || !Number.isFinite(price) || price <= 0) {
		console.warn(`[stocks] Yahoo zero/invalid price for ${internalSymbol} (${yahooSymbol})`);
		return { symbol: internalSymbol, ...ZERO, type, currency };
	}

	const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? 0);
	const change = Number.isFinite(prevClose) ? price - prevClose : 0;
	const percentNum = Number.isFinite(prevClose) && prevClose > 0 ? (change / prevClose) * 100 : 0;

	return {
		symbol: internalSymbol,
		price,
		change: Number.isFinite(change) ? change : 0,
		changePercent: toPercentString(percentNum),
		type,
		currency,
	};
}

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	const unauthorized = await rejectIfNoUser(req, corsHeaders);
	if (unauthorized) return unauthorized;

	try {
		let { symbols = ["KOSPI", "NASDAQ", "SP500", "USDKRW"] } = await req.json();
		// 심볼 하나당 유료 API 호출 1회 → 개수·형식 제한. 잘못된 심볼 하나 때문에 전체가
		// 실패하지 않도록 형식이 틀린 것만 제외
		if (!Array.isArray(symbols)) throw new Error("invalid symbols");
		symbols = symbols
			.filter((s): s is string => typeof s === "string" && SYMBOL_RE.test(s))
			.slice(0, MAX_SYMBOLS);
		const apiKey = Deno.env.get("TWELVEDATA_API_KEY")?.trim() ?? "";

		if (!apiKey) {
			return new Response(JSON.stringify({ error: "TWELVEDATA_API_KEY not set" }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		// 내부 심볼 → TwelveData 심볼 매핑 (환율은 TwelveData에서 정상 동작).
		// 지수/원자재는 YAHOO_SYMBOL_MAP을 통해 Yahoo에서 처리한다.
		const symbolMap: Record<string, string> = {
			USDKRW: "USD/KRW",
		};

		const results = await Promise.all(
			symbols.map(async (sym: string) => {
				try {
					const yahooSymbol = YAHOO_SYMBOL_MAP[sym];
					if (yahooSymbol) {
						return await fetchYahooQuote(sym, yahooSymbol);
					}

					const tdSymbol = symbolMap[sym] || sym;
					const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${encodeURIComponent(apiKey)}`;

					const data = await fetchJsonWithTimeout(url, TWELVEDATA_TIMEOUT_MS);

					if (isTwelveError(data)) {
						const p = data as Record<string, unknown>;
						console.error(`[stocks] TwelveData error for ${sym}:`, p.code, p.message, p.status);
						return { symbol: sym, ...ZERO, type: "unknown", currency: "", error: `Twelve Data ${p.code ?? "error"}` };
					}

					const p = data as Record<string, unknown>;
					const price = Number(p.close ?? p.price ?? 0);
					if (!Number.isFinite(price) || price <= 0) {
						console.warn(`[stocks] Zero price for ${sym}, raw close:`, p.close);
						return { symbol: sym, ...ZERO, type: normalizeTwelveDataType(p.type as string | undefined, tdSymbol), currency: String(p.currency ?? "").toUpperCase() };
					}

					const change = Number(p.change ?? 0);
					const percent = normalizePercent(p.percent_change, change);

					return {
						symbol: sym,
						price,
						change: Number.isFinite(change) ? change : 0,
						changePercent: percent,
						type: normalizeTwelveDataType(p.type as string | undefined, tdSymbol),
						currency: String(p.currency ?? "").toUpperCase(),
					};
				} catch (e: unknown) {
					const msg = e instanceof Error ? e.message : String(e);
					console.error(`[stocks] fetch error for ${sym}:`, msg);
					return { symbol: sym, ...ZERO, type: "unknown", currency: "", error: msg.startsWith("HTTP ") ? msg : "fetch failed" };
				}
			}),
		);

		return new Response(JSON.stringify(results), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error("[stocks] request error:", msg.slice(0, 500));
		return new Response(JSON.stringify({ error: msg === "invalid symbols" ? msg : "stocks request failed" }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
