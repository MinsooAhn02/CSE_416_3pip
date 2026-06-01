import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";
import { supabase } from "../../lib/supabase";
import FloatingLines from "../common/FloatingLines";

const LoginScreen = () => {
	const { t } = useTranslation();
	const login = useAuthStore((s) => s.login);
	const [loading, setLoading] = useState<boolean>(false);

	const handleLogin = async () => {
		setLoading(true);
		await login();
		// Supabase는 redirect 방식이므로 setLoading(false)는 redirect 전에는 도달하지 않음
		if (!supabase) setLoading(false);
	};

	return (
		<div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center text-white font-sans relative overflow-hidden">
			{/* Animated FloatingLines background (subtle, brand blue/indigo) */}
			<div className="absolute inset-0 z-0 opacity-40">
				<FloatingLines
					linesGradient={["#1e3a8a", "#4f46e5", "#818cf8"]}
					enabledWaves={["top", "middle", "bottom"]}
					lineCount={[10, 15, 20]}
					lineDistance={[8, 6, 4]}
					animationSpeed={0.6}
					bendRadius={5.0}
					bendStrength={-0.5}
					interactive={true}
					parallax={true}
				/>
			</div>
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] z-0" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] z-0" />
			<div className="relative z-10 flex flex-col items-center gap-8 pointer-events-none [&_button]:pointer-events-auto">
				<div className="text-center">
					<h1 className="text-5xl font-bold tracking-tight mb-2">
						Morning
						<span className="text-blue-400">Briefing</span>.AI
					</h1>
					<p className="text-white/60 text-lg">{t("auth.subtitle")}</p>
				</div>
				<button
					onClick={handleLogin}
					disabled={loading}
					className="flex items-center gap-3 bg-white text-slate-800 px-8 py-4 rounded-2xl font-bold text-base hover:bg-blue-50 transition-all shadow-2xl hover:shadow-blue-500/20 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<span className="text-2xl">G</span>
					{loading ? t("auth.signing_in") : t("auth.start_with_google")}
				</button>
				<p className="text-white/30 text-xs">
					{supabase
						? t("auth.oauth_note")
						: t("auth.demo_note")}
				</p>
			</div>
		</div>
	);
};

export default LoginScreen;
