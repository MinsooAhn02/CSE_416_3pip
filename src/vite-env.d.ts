/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL: string;
	readonly VITE_SUPABASE_ANON_KEY: string;
	readonly VITE_GOOGLE_MAPS_API_KEY: string;
	readonly VITE_DEBUG_FLOW: string;
	[key: string]: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
