import { useEffect } from "react";
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
	const handleAuthChange = useAuthStore((s) => s.handleAuthChange);
	const { isDark } = useTheme();
	const fetchAll = useDataStore((s) => s.fetchAll);
	const bgImage = useSettingsStore((s) => s.bgImage);

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

	// Hydrate stores & fetch data on login
	useEffect(() => {
		if (!isLoggedIn) return;
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
			fetchAll();
			generateAiTodoOnLoad();
		};
		init();
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
		</div>
	);
};

export default App;
