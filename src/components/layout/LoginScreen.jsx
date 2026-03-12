import { useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { supabase } from "../../lib/supabase";

const LoginScreen = () => {
	const login = useAuthStore((s) => s.login);
	const [loading, setLoading] = useState(false);

	const handleLogin = async () => {
		setLoading(true);
		await login();
		// Supabase는 redirect 방식이므로 setLoading(false)는 redirect 전에는 도달하지 않음
		if (!supabase) setLoading(false);
	};

	return (
		<div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center text-white font-sans">
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
			<div className="relative z-10 flex flex-col items-center gap-8">
				<div className="text-center">
					<h1 className="text-5xl font-bold tracking-tight mb-2">
						Morning
						<span className="text-blue-400">Brief</span>.AI
					</h1>
					<p className="text-white/60 text-lg">나만을 위한 AI 모닝 대시보드</p>
				</div>
				<button
					onClick={handleLogin}
					disabled={loading}
					className="flex items-center gap-3 bg-white text-slate-800 px-8 py-4 rounded-2xl font-bold text-base hover:bg-blue-50 transition-all shadow-2xl hover:shadow-blue-500/20 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<span className="text-2xl">G</span>
					{loading ? "로그인 중..." : "구글 계정으로 시작하기"}
				</button>
				<p className="text-white/30 text-xs">
					{supabase
						? "Google OAuth · 광고 없는 순수 개인화 경험"
						: "데모 모드 · .env에 Supabase 키를 설정하면 실제 로그인 가능"}
				</p>
			</div>
		</div>
	);
};

export default LoginScreen;
