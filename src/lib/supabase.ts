import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn(
		"[Supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 .env에 설정되지 않았습니다. 오프라인 모드로 동작합니다.",
	);
}

export const supabase: SupabaseClient | null =
	supabaseUrl && supabaseAnonKey
		? createClient(supabaseUrl, supabaseAnonKey)
		: null;
