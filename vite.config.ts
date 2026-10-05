/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 테스트는 서울 시간대로 고정 — "UTC 날짜 = 한국 09시 전엔 어제" 같은 버그를 잡기 위해 (CI도 동일)
if (process.env.VITEST) process.env.TZ = "Asia/Seoul";

export default defineConfig({
	plugins: [react()],
	server: {
		port: 3000,
		strictPort: true,
		open: true,
	},
	test: {
		environment: "jsdom",
		// 로컬 .env가 있어도 테스트는 실제 Supabase·Edge Function을 절대 호출하지 않음 (supabase = null)
		env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
		restoreMocks: true,
		unstubEnvs: true,
		unstubGlobals: true,
	},
});
