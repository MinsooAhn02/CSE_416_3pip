import { useEffect, useRef } from "react";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
import { useTodoStore } from "./store/useTodoStore";
import { useDiaryStore } from "./store/useDiaryStore";
import { useTheme } from "./hooks/useTheme";
import { useMidnightTrigger } from "./hooks/useMidnightTrigger";
import { supabase } from "./lib/supabase";
import { generateAiTodo } from "./services/aiService";

import LoginScreen from "./components/layout/LoginScreen";
import TopNav from "./components/layout/TopNav";
import DashboardLayout from "./components/layout/DashboardLayout";
import FixedButtons from "./components/layout/FixedButtons";
import OnboardingModal from "./components/modals/OnboardingModal";
import SettingsModal from "./components/modals/SettingsModal";
import BriefSettingsModal from "./components/modals/BriefSettingsModal";
import FirstLoginBriefingModal from "./components/modals/FirstLoginBriefingModal";

/* ── v8: 1:3:3 Layout Architecture with Widget Scroll Box (REQ-WS-001) ── */

const App = () => {
	const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
	const user = useAuthStore((s) => s.user);
	const handleAuthChange = useAuthStore((s) => s.handleAuthChange);
	const { isDark } = useTheme();
	const fetchAll = useDataStore((s) => s.fetchAll);
	const bgImage = useSettingsStore((s) => s.bgImage);
	const initDoneRef = useRef(false);

	// Use the new midnight trigger hook (REQ-CS-005, REQ-AJ-001)
	useMidnightTrigger(isLoggedIn);

	// Supabase auth listener
	useEffect(() => {
		if (!supabase) return;
		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			(_event, session) => handleAuthChange(session)
		);
		return () => subscription?.unsubscribe();
	}, [handleAuthChange]);

	// 로그인 or 자동 로그인 시 초기 데이터 로드
	// user?.id 의존성: 자동 로그인 시 Supabase 세션 복원 후 user가 세팅되면 실행
	useEffect(() => {
		if (!isLoggedIn || !user?.id) {
			// 로그아웃 시 다음 로그인을 위해 초기화
			if (!isLoggedIn) initDoneRef.current = false;
			return;
		}
		// 같은 세션에서 중복 실행 방지
		if (initDoneRef.current) return;
		initDoneRef.current = true;

		const init = async () => {
			try {
				await Promise.all([
					useSettingsStore.getState().hydrateFromDB?.(),
					useWidgetStore.getState().hydrateFromDB?.(),
					useTodoStore.getState().hydrateFromDB?.(),
					useDiaryStore.getState().hydrateFromDB?.(),
				]);
			} catch (e) {
				console.warn("Hydrate failed:", e?.message);
			}
			// 캐시 우선: 1시간 이내 캐시 있으면 API 호출 없이 즉시 표시
			await fetchAll({ useExistingCache: true });
			generateAiTodoOnLoad();
		};
		init();
	}, [isLoggedIn, user?.id, fetchAll]);

	// 탭이 다시 포커스될 때 캐시 만료(1시간) 확인 → 자동 갱신
	useEffect(() => {
		if (!isLoggedIn) return;
		const handleVisibility = () => {
			if (document.visibilityState !== "visible") return;
			if (!useAuthStore.getState().user?.id) return;
			// useExistingCache: true → readApiCache가 1시간 TTL로 판단
			// 만료됐으면 자동으로 API 재호출, 아니면 캐시 사용
			fetchAll({ useExistingCache: true });
		};
		document.addEventListener("visibilitychange", handleVisibility);
		return () => document.removeEventListener("visibilitychange", handleVisibility);
	}, [isLoggedIn, fetchAll]);

	/**
	 * AI Todo 자동 생성 — 앱 로드 시 1회 실행
	 */
	const generateAiTodoOnLoad = async () => {
		const events = useDataStore.getState().calEvents || [];
		const existingTodos = useTodoStore.getState().todos || [];
		if (events.length === 0) return;

		try {
			const aiTodos = await generateAiTodo(events, existingTodos);
			if (aiTodos.length > 0) {
				await useTodoStore.getState().addAiTodos(aiTodos);
				console.log("[App] AI Todo 자동 생성 완료:", aiTodos.length, "개");
			}
		} catch (e) {
			console.warn("AI Todo generation failed:", e?.message);
		}
	};

	if (!isLoggedIn) return <LoginScreen />;

	return (
		<div
			className={`min-h-screen w-full font-sans relative transition-colors duration-300 ${
				isDark
					? "bg-morning-dark-page text-morning-dark-text"
					: "bg-morning-light-page text-morning-light-text"
			}`}
			style={{
				backgroundImage: bgImage ? `url(${bgImage})` : 'none',
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				backgroundAttachment: 'fixed'
			}}
		>
			<TopNav />

			{/* v8: 1:3:3 Dashboard Layout Architecture with Widget Scroll Box (REQ-WS-001) */}
			<DashboardLayout />

			{/* Modals & Fixed Components */}
			<FixedButtons />
			<OnboardingModal />
			<SettingsModal />
			<BriefSettingsModal />
			<FirstLoginBriefingModal />

			{/* Global Toast Notifications */}
			<Toaster
				position="bottom-center"
				toastOptions={{
					duration: 2000,
					style: {
						background: isDark ? "#25272C" : "#FFFDF8",
						color: isDark ? "#ECE8DF" : "#2F2A22",
						border: `1px solid ${isDark ? "#3A3D45" : "#E6DECD"}`,
						fontSize: "13px",
						fontWeight: 500,
						padding: "10px 14px",
						borderRadius: "12px",
						boxShadow: isDark
							? "0 8px 24px rgba(0,0,0,0.45)"
							: "0 8px 24px rgba(47,42,34,0.12)",
					},
					success: {
						iconTheme: {
							primary: isDark ? "#84A0CF" : "#5D7FCB",
							secondary: isDark ? "#25272C" : "#FFFDF8",
						},
					},
					error: {
						iconTheme: {
							primary: "#ef4444",
							secondary: isDark ? "#25272C" : "#FFFDF8",
						},
					},
				}}
			/>
		</div>
	);
};

export default App;
