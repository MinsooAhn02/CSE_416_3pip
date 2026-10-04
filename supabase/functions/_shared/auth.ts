import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 로그인한 Supabase 사용자만 통과. anon key도 유효한 JWT라 게이트웨이 verify_jwt만으로는
 * 익명 호출(유료 API 쿼터 소진)을 막지 못함 → 실제 user 조회로 확인.
 * 성공 시 user, 실패 시 401 Response.
 */
export const getUserOrReject = async (
	req: Request,
	corsHeaders: Record<string, string>,
): Promise<User | Response> => {
	const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
	const supabase = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_ANON_KEY")!,
	);
	const { data: { user }, error } = await supabase.auth.getUser(jwt);
	if (error || !user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
	return user;
};

/** 통과하면 null, 실패하면 401 Response. */
export const rejectIfNoUser = async (
	req: Request,
	corsHeaders: Record<string, string>,
): Promise<Response | null> => {
	const result = await getUserOrReject(req, corsHeaders);
	return result instanceof Response ? result : null;
};
