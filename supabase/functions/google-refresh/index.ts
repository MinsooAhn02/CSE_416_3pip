import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserOrReject } from "../_shared/auth.ts";

/**
 * Google refresh token을 서버에 보관하고, 그걸로 1시간짜리 access token을 갱신 (BACKLOG R2).
 *   { action: "store", refresh_token }  → 암호화해서 google_tokens에 저장 (OAuth 직후 1회)
 *   { action: "refresh" }               → 저장된 토큰으로 갱신 → { access_token, expires_in }
 * 브라우저는 refresh token을 보관하지 않음. 토큰이 없거나 Google이 거부하면
 * 409 { error: "reconnect_required" } → 클라이언트가 재연결(동의 화면 포함) 배너 표시.
 * 필요 secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENC_KEY(base64 32바이트)
 */

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const getKey = async (): Promise<CryptoKey> => {
	const raw = Deno.env.get("GOOGLE_TOKEN_ENC_KEY");
	if (!raw) throw new Error("GOOGLE_TOKEN_ENC_KEY not set");
	const bytes = unb64(raw);
	if (bytes.length !== 32) throw new Error("GOOGLE_TOKEN_ENC_KEY must be 32 bytes (base64)");
	return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
};

// 저장 형식: v1:<iv base64>:<ciphertext base64>
const encrypt = async (plain: string): Promise<string> => {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), new TextEncoder().encode(plain));
	return `v1:${b64(iv)}:${b64(new Uint8Array(ct))}`;
};

const decrypt = async (stored: string): Promise<string> => {
	const [ver, iv, ct] = stored.split(":");
	if (ver !== "v1" || !iv || !ct) throw new Error("unknown token format");
	const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await getKey(), unb64(ct));
	return new TextDecoder().decode(pt);
};

serve(async (req) => {
	if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

	const user = await getUserOrReject(req, corsHeaders);
	if (user instanceof Response) return user;

	const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
	const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
	if (!clientId || !clientSecret) return json({ error: "Google credentials not configured" }, 500);

	// service role: google_tokens는 클라이언트 권한이 없는 테이블
	const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

	try {
		const body = await req.json().catch(() => ({}));
		// 예전 클라이언트는 { refresh_token }만 보냄 → 저장 후 갱신으로 처리
		const action = body.action ?? (body.refresh_token ? "store_and_refresh" : "refresh");

		if (action === "store" || action === "store_and_refresh") {
			const token = String(body.refresh_token ?? "");
			if (!token || token.length > 2048) return json({ error: "refresh_token required" }, 400);
			const { error } = await admin.from("google_tokens").upsert({
				user_id: user.id,
				refresh_token_enc: await encrypt(token),
				updated_at: new Date().toISOString(),
			});
			if (error) throw new Error(`store failed: ${error.message}`);
			if (action === "store") return json({ ok: true });
		}

		const { data: row, error: readErr } = await admin
			.from("google_tokens")
			.select("refresh_token_enc")
			.eq("user_id", user.id)
			.maybeSingle();
		if (readErr) throw new Error(`read failed: ${readErr.message}`);
		if (!row) return json({ error: "reconnect_required", reason: "no_token" }, 409);

		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				refresh_token: await decrypt(row.refresh_token_enc),
				grant_type: "refresh_token",
			}).toString(),
		});
		const tokenData = await tokenRes.json();

		if (!tokenRes.ok || !tokenData.access_token) {
			// invalid_grant: 사용자가 권한을 취소했거나 토큰 만료 → 보관 토큰 폐기, 재연결 필요
			if (tokenData.error === "invalid_grant") {
				await admin.from("google_tokens").delete().eq("user_id", user.id);
				return json({ error: "reconnect_required", reason: "invalid_grant" }, 409);
			}
			console.error("google token refresh failed:", tokenRes.status, tokenData.error);
			return json({ error: "Token refresh failed" }, 502);
		}

		return json({ access_token: tokenData.access_token, expires_in: tokenData.expires_in ?? 3600 });
	} catch (e: unknown) {
		console.error("google-refresh error:", e instanceof Error ? e.message : e);
		return json({ error: "internal error" }, 500);
	}
});
