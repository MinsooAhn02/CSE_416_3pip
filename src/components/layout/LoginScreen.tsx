import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
	Sparkles,
	CloudSun,
	TrendingUp,
	Newspaper,
	Calendar,
	HeartPulse,
	BookOpen,
	LayoutGrid,
	ChevronDown,
	ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { supabase } from "../../lib/supabase";
// three.js(~480KB)는 로그인 배경에만 쓰임 → 메인 번들에서 분리
const FloatingLines = lazy(() => import("../common/FloatingLines"));

const FEATURES = [
	{ icon: Sparkles, title: "login_screen.f_briefing_t", desc: "login_screen.f_briefing_d" },
	{ icon: CloudSun, title: "login_screen.f_weather_t", desc: "login_screen.f_weather_d" },
	{ icon: TrendingUp, title: "login_screen.f_stocks_t", desc: "login_screen.f_stocks_d" },
	{ icon: Newspaper, title: "login_screen.f_news_t", desc: "login_screen.f_news_d" },
	{ icon: Calendar, title: "login_screen.f_calendar_t", desc: "login_screen.f_calendar_d" },
	{ icon: HeartPulse, title: "login_screen.f_health_t", desc: "login_screen.f_health_d" },
	{ icon: BookOpen, title: "login_screen.f_diary_t", desc: "login_screen.f_diary_d" },
	{ icon: LayoutGrid, title: "login_screen.f_smart_t", desc: "login_screen.f_smart_d" },
];

// 확장 프로그램(새 탭)에서는 three.js 배경을 로드하지 않음
const IS_EXTENSION = typeof location !== "undefined" && location.protocol === "chrome-extension:";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const LoginScreen = () => {
	const { t } = useTranslation();
	const login = useAuthStore((s) => s.login);
	const [loading, setLoading] = useState<boolean>(false);
	const bgRef = useRef<HTMLDivElement>(null);
	const [reducedMotion, setReducedMotion] = useState<boolean>(
		() => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches
	);
	useEffect(() => {
		if (typeof window.matchMedia !== "function") return;
		const mq = window.matchMedia(REDUCED_MOTION_QUERY);
		const onChange = () => setReducedMotion(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	const showLines = !IS_EXTENSION && !reducedMotion;

	const handleLogin = async () => {
		setLoading(true);
		await login();
		// Supabase는 redirect 방식이므로 setLoading(false)는 redirect 전에는 도달하지 않음
		if (!supabase) setLoading(false);
	};

	// 샘플 데이터 모듈은 버튼을 눌렀을 때만 로드
	const handleGuest = async () => {
		const { enterGuestMode } = await import("../../demo/demoData");
		enterGuestMode();
	};

	// Forward pointer events from the scroll layer (z-10) down to the THREE.js
	// canvas (z-0) so FloatingLines' interactive wave-bending + parallax still work.
	const forwardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const canvas = bgRef.current?.querySelector<HTMLCanvasElement>("canvas");
		if (!canvas) return;
		canvas.dispatchEvent(
			new PointerEvent("pointermove", { clientX: e.clientX, clientY: e.clientY, bubbles: false })
		);
	};
	const forwardPointerLeave = () => {
		const canvas = bgRef.current?.querySelector<HTMLCanvasElement>("canvas");
		if (!canvas) return;
		canvas.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
	};

	return (
		<div
			className="relative h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white font-sans overflow-hidden"
			onPointerMove={forwardPointerMove}
			onPointerLeave={forwardPointerLeave}
		>
			{/* Animated FloatingLines background (subtle, brand blue/indigo) — fixed behind scrolling content */}
			<div ref={bgRef} className="absolute inset-0 z-0 opacity-40">
				{showLines && (
				<Suspense fallback={null}>
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
				</Suspense>
				)}
			</div>
			<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] z-0" />
			<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] z-0" />

			{/* Scrollable content layer on top of the fixed background */}
			<div className="relative z-10 h-screen overflow-y-auto">
				{/* Hero — first viewport */}
				<section className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
					<div className="mb-8">
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
					<button
						onClick={handleGuest}
						className="mt-4 text-sm text-white/70 underline underline-offset-4 hover:text-white transition-colors"
					>
						{t("auth.explore_as_guest")}
					</button>
					<p className="text-white/30 text-xs mt-8">
						{supabase ? t("auth.oauth_note") : t("auth.demo_note")}
					</p>

					{/* Scroll-down affordance pointing to the instructions */}
					<div className="absolute bottom-8 flex flex-col items-center gap-1 text-white/40 animate-bounce">
						<span className="text-xs">{t("login_screen.scroll_hint")}</span>
						<ChevronDown className="w-5 h-5" />
					</div>
				</section>

				{/* Instructions for newcomers */}
				<div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
					{/* 1) What is it */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-3">
							{t("login_screen.what_is_title_pre")}<span className="text-blue-400">{t("login_screen.what_is_title_mid")}</span>{t("login_screen.what_is_title_post")}
						</h2>
						<p className="text-white/70 leading-relaxed">
							{t("login_screen.what_is_p1")}
						</p>
						<p className="text-white/70 leading-relaxed mt-3">
							{t("login_screen.what_is_p2")}
						</p>
					</section>

					{/* 2) How to get started */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-4">{t("login_screen.start_title")}</h2>
						<ol className="space-y-4">
							{[1, 2, 3, 4].map((step, i) => (
								<li key={i} className="flex gap-4">
									<span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center font-bold text-blue-300">
										{i + 1}
									</span>
									<div>
										<h3 className="font-semibold">{t(`login_screen.step${step}_h`)}</h3>
										<p className="text-white/60 text-sm leading-relaxed">
											{t(`login_screen.step${step}_d`)}
										</p>
									</div>
								</li>
							))}
						</ol>
					</section>

					{/* 3) Feature overview */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-4">{t("login_screen.see_title")}</h2>
						<div className="grid sm:grid-cols-2 gap-4">
							{FEATURES.map(({ icon: Icon, title, desc }) => (
								<div
									key={title}
									className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
								>
									<Icon className="w-6 h-6 flex-shrink-0 text-blue-300 mt-0.5" />
									<div>
										<h3 className="font-semibold">{t(title)}</h3>
										<p className="text-white/60 text-sm leading-relaxed">
											{t(desc)}
										</p>
									</div>
								</div>
							))}
						</div>
					</section>

					{/* 4) Make it yours */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-4">{t("login_screen.yours_title")}</h2>
						<ul className="space-y-2 text-white/70 list-disc list-inside leading-relaxed">
							<li>{t("login_screen.yours_1")}</li>
							<li>{t("login_screen.yours_2")}</li>
							<li>{t("login_screen.yours_3")}</li>
							<li>{t("login_screen.yours_4")}</li>
							<li>{t("login_screen.yours_5")}</li>
						</ul>
					</section>

					{/* 5) Google unverified-app notice */}
					<section className="bg-amber-400/10 border border-amber-300/20 rounded-2xl p-6">
						<div className="flex gap-3">
							<ShieldAlert className="w-6 h-6 flex-shrink-0 text-amber-300 mt-0.5" />
							<div>
								<h2 className="text-xl font-bold mb-2">
									{t("login_screen.notice_title")}
								</h2>
								<p className="text-white/70 leading-relaxed text-sm">
									{t("login_screen.notice_p1_pre")}
									<span className="font-semibold">{t("login_screen.notice_warning")}</span>
									{t("login_screen.notice_p1_post")}
								</p>
								<p className="text-white/70 leading-relaxed text-sm mt-2">
									{t("login_screen.notice_p2_pre")}
									<span className="font-semibold">{t("login_screen.notice_advanced")}</span> &rarr;{" "}
									<span className="font-semibold">{t("login_screen.notice_continue")}</span>
									{t("login_screen.notice_p2_post")}
								</p>
							</div>
						</div>
					</section>

					<footer className="text-center text-white/30 text-xs pt-2">
						{t("login_screen.footer")}
					</footer>
				</div>
			</div>
		</div>
	);
};

export default LoginScreen;
