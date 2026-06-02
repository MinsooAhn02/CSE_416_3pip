import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const ZERO = { price: 0, change: 0, changePercent: "0%" };
const TWELVEDATA_TIMEOUT_MS = 8000;

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
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

serve(async (req) => {
	if (req.method === "OPTIONS")
		return new Response("ok", { headers: corsHeaders });

	try {
		const { symbols = ["KOSPI", "NASDAQ", "SP500", "USDKRW"] } = await req.json();
		const apiKey = Deno.env.get("TWELVEDATA_API_KEY")?.trim() ?? "";

		if (!apiKey) {
			return new Response(JSON.stringify({ error: "TWELVEDATA_API_KEY not set" }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		// 내부 심볼 → TwelveData 심볼 매핑
		const symbolMap: Record<string, string> = {
			KOSPI:  "KS11",
			NASDAQ: "IXIC",
			SP500:  "SPX",
			USDKRW: "USD/KRW",
			VIX:    "VIX",
			CRUDE:  "USOIL",
			DXY:    "DXY",
			DJI:    "DJI",
		};

		const results = await Promise.all(
			symbols.map(async (sym: string) => {
				try {
					const tdSymbol = symbolMap[sym] || sym;
					const exchange = tdSymbol === "KS11" ? "&exchange=XKOS" : "";
					const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbol)}${exchange}&apikey=${encodeURIComponent(apiKey)}`;

					const data = await fetchJsonWithTimeout(url, TWELVEDATA_TIMEOUT_MS);

					if (isTwelveError(data)) {
						const p = data as Record<string, unknown>;
						console.error(`[stocks] TwelveData error for ${sym}:`, p.code, p.message, p.status);
						return { symbol: sym, ...ZERO, type: "unknown", currency: "", error: String(p.message ?? "API error") };
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
					return { symbol: sym, ...ZERO, type: "unknown", currency: "", error: msg };
				}
			}),
		);

		return new Response(JSON.stringify(results), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return new Response(JSON.stringify({ error: msg }), {
			status: 400,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
