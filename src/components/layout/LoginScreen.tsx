import { useState, useRef } from "react";
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
import FloatingLines from "../common/FloatingLines";

const FEATURES = [
	{
		icon: Sparkles,
		title: "AI Briefing",
		desc: "A short, narrated summary of your morning — schedule, weather, news, and more in one read.",
	},
	{
		icon: CloudSun,
		title: "Weather",
		desc: "Current conditions, humidity, precipitation, and air quality. Toggle between °C and °F.",
	},
	{
		icon: TrendingUp,
		title: "Stocks",
		desc: "Major indices at a glance plus any tickers you add yourself.",
	},
	{
		icon: Newspaper,
		title: "News & Trends",
		desc: "Personalized headlines based on your interests, alongside real-time trending topics.",
	},
	{
		icon: Calendar,
		title: "Calendar & Tasks",
		desc: "Today's events and to-dos. Connect Google Calendar to sync automatically.",
	},
	{
		icon: HeartPulse,
		title: "Health",
		desc: "Steps, sleep, and calories. Connect Google Fit to see your real activity.",
	},
	{
		icon: BookOpen,
		title: "Diary & Q&A",
		desc: "A daily question and a private, PIN-protected diary that the AI can help you write.",
	},
	{
		icon: LayoutGrid,
		title: "Smart Widgets",
		desc: "Add any keyword — a brand, hobby, or person — and get a widget that tracks it for you.",
	},
];

const LoginScreen = () => {
	const { t } = useTranslation();
	const login = useAuthStore((s) => s.login);
	const [loading, setLoading] = useState<boolean>(false);
	const bgRef = useRef<HTMLDivElement>(null);

	const handleLogin = async () => {
		setLoading(true);
		await login();
		// Supabase는 redirect 방식이므로 setLoading(false)는 redirect 전에는 도달하지 않음
		if (!supabase) setLoading(false);
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
					<p className="text-white/30 text-xs mt-8">
						{supabase ? t("auth.oauth_note") : t("auth.demo_note")}
					</p>

					{/* Scroll-down affordance pointing to the instructions */}
					<div className="absolute bottom-8 flex flex-col items-center gap-1 text-white/40 animate-bounce">
						<span className="text-xs">New here? Learn how it works</span>
						<ChevronDown className="w-5 h-5" />
					</div>
				</section>

				{/* Instructions for newcomers */}
				<div className="max-w-3xl mx-auto px-4 py-16 space-y-10">
					{/* 1) What is it */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-3">
							What is Morning<span className="text-blue-400">Briefing</span>.AI?
						</h2>
						<p className="text-white/70 leading-relaxed">
							MorningBriefing.AI is a personal dashboard that gathers your day —
							weather, stocks, news, trends, calendar, health, and a private diary —
							into a single screen and an AI-written morning briefing tailored to
							your interests. Instead of checking a dozen apps, you open one tab and
							see what actually matters to you.
						</p>
						<p className="text-white/70 leading-relaxed mt-3">
							It works as both a web app and a Chrome new-tab extension, so your
							briefing can greet you every time you open your browser.
						</p>
					</section>

					{/* 2) How to get started */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-4">How to get started</h2>
						<ol className="space-y-4">
							{[
								{
									h: "Sign in with Google",
									d: "Click “Continue with Google” above. Your account keeps your settings and data private to you.",
								},
								{
									h: "Choose your interests",
									d: "A quick onboarding lets you pick interest categories and a briefing tone so your content feels personal from day one.",
								},
								{
									h: "Connect Google (optional)",
									d: "Allow Google Calendar and Fitness access to power the schedule and health widgets. You can skip this and add it later.",
								},
								{
									h: "Explore your dashboard",
									d: "Your personalized dashboard appears. Read the AI briefing, then browse the weather, news, stocks, and other widgets.",
								},
							].map((step, i) => (
								<li key={i} className="flex gap-4">
									<span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center font-bold text-blue-300">
										{i + 1}
									</span>
									<div>
										<h3 className="font-semibold">{step.h}</h3>
										<p className="text-white/60 text-sm leading-relaxed">
											{step.d}
										</p>
									</div>
								</li>
							))}
						</ol>
					</section>

					{/* 3) Feature overview */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-4">What you'll see</h2>
						<div className="grid sm:grid-cols-2 gap-4">
							{FEATURES.map(({ icon: Icon, title, desc }) => (
								<div
									key={title}
									className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
								>
									<Icon className="w-6 h-6 flex-shrink-0 text-blue-300 mt-0.5" />
									<div>
										<h3 className="font-semibold">{title}</h3>
										<p className="text-white/60 text-sm leading-relaxed">
											{desc}
										</p>
									</div>
								</div>
							))}
						</div>
					</section>

					{/* 4) Make it yours */}
					<section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
						<h2 className="text-2xl font-bold mb-4">Make it yours</h2>
						<ul className="space-y-2 text-white/70 list-disc list-inside leading-relaxed">
							<li>Drag and drop widgets to rearrange your layout.</li>
							<li>Refresh any widget on its own with its refresh icon.</li>
							<li>
								Open Settings to change theme, clock style, temperature units,
								stock tickers, and your diary PIN.
							</li>
							<li>
								Add Smart Widgets for any keyword you want to keep an eye on.
							</li>
							<li>
								Switch between English and Korean any time from the top bar.
							</li>
						</ul>
					</section>

					{/* 5) Google unverified-app notice */}
					<section className="bg-amber-400/10 border border-amber-300/20 rounded-2xl p-6">
						<div className="flex gap-3">
							<ShieldAlert className="w-6 h-6 flex-shrink-0 text-amber-300 mt-0.5" />
							<div>
								<h2 className="text-xl font-bold mb-2">
									First sign-in: a Google notice you can safely pass
								</h2>
								<p className="text-white/70 leading-relaxed text-sm">
									This is a student project running in Google's{" "}
									<span className="font-semibold">Testing</span> mode, so on your
									first sign-in Google may show a{" "}
									<span className="font-semibold">
										&ldquo;Google hasn&rsquo;t verified this app&rdquo;
									</span>{" "}
									warning. This is expected.
								</p>
								<p className="text-white/70 leading-relaxed text-sm mt-2">
									To continue, click{" "}
									<span className="font-semibold">Advanced</span> &rarr;{" "}
									<span className="font-semibold">
										Continue to MorningBriefing.AI (unsafe)
									</span>
									. It's a standard policy gate for unverified apps, not a sign of
									any problem with the app or your account.
								</p>
							</div>
						</div>
					</section>

					<footer className="text-center text-white/30 text-xs pt-2">
						MorningBriefing.AI · Built with React, Vite &amp; Supabase
					</footer>
				</div>
			</div>
		</div>
	);
};

export default LoginScreen;
