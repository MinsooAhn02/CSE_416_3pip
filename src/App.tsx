import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { Session } from "@supabase/supabase-js";
import { useAuthStore } from "./store/useAuthStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useWidgetStore } from "./store/useWidgetStore";
import { useDataStore } from "./store/useDataStore";
import { useTodoStore } from "./store/useTodoStore";
import { useDiaryStore } from "./store/useDiaryStore";
import { useBriefingHistoryStore } from "./store/useBriefingHistoryStore";
import { useTheme } from "./hooks/useTheme";
import { useMidnightTrigger } from "./hooks/useMidnightTrigger";
import { supabase, openedFromOAuthRedirect } from "./lib/supabase";

import LoginScreen from "./components/layout/LoginScreen";
import TopNav from "./components/layout/TopNav";
import DashboardLayout from "./components/layout/DashboardLayout";
import ExtensionInstallBanner from "./components/banners/ExtensionInstallBanner";
import GuestBanner from "./components/banners/GuestBanner";
import GoogleReconnectBanner from "./components/banners/GoogleReconnectBanner";

const FixedButtons = lazy(() => import("./components/layout/FixedButtons"));
const OnboardingModal = lazy(() => import("./components/modals/OnboardingModal"));
const SettingsModal = lazy(() => import("./components/modals/SettingsModal"));
const FirstLoginBriefingModal = lazy(() => import("./components/modals/FirstLoginBriefingModal"));
const WidgetSettingsModal = lazy(() => import("./components/modals/WidgetSettingsModal"));

/* ── v8: 1:3:3 Layout Architecture with Widget Scroll Box (REQ-WS-001) ── */

const App = () => {
	const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
	const user = useAuthStore((s) => s.user);
	const handleAuthChange = useAuthStore((s) => s.handleAuthChange);
	const { isDark } = useTheme();
	const { t } = useTranslation();
	// Zustand actions are stable references by design, but we wrap in useCallback
	// with empty deps to make the stability guarantee explicit and prevent any
	// future refactor from accidentally reintroducing stale-closure re-triggers.
	const _fetchAll = useDataStore((s) => s.fetchAll);
	const fetchAll = useCallback(_fetchAll, []); // eslint-disable-line react-hooks/exhaustive-deps

	const bgImage = useSettingsStore((s) => s.bgImage);
	// initPhaseRef gates fetchAll so it never fires more than once per login phase
	// (prevents double-trigger from strict-mode double-mount or concurrent auth events)
	const initPhaseRef = useRef<string>("none");

	const [authBootstrapDone, setAuthBootstrapDone] = useState(!supabase);
	const [hydrateComplete, setHydrateComplete] = useState(false);

	// Gate midnight trigger until stores are hydrated so it never fires on stale/empty data
	useMidnightTrigger(isLoggedIn && hydrateComplete);

	// Supabase auth listener
	// onAuthStateChange 단독으로는 INITIAL_SESSION 이벤트가 StrictMode 2중 mount,
	// Supabase _recoverAndRefresh 와 구독 등록 사이의 race, 또는 세션 갱신 중
	// lock 경합 상황에서 누락되는 엣지 케이스가 있음.
	// → 마운트 시 getSession()으로 현재 세션을 명시적으로 조회해서
	//   handleAuthChange를 한번 불러주고, 이후 로그인/로그아웃/토큰갱신 이벤트는
	//   onAuthStateChange로 이어서 수신.
	useEffect(() => {
		if (!supabase) {
			setAuthBootstrapDone(true);
			return;
		}
		let cancelled = false;

		// 1) 마운트 직후 현재 세션을 적극적으로 조회 (구독 타이밍과 무관)
		supabase.auth
			.getSession()
			.then(({ data: { session } }: { data: { session: Session | null } }) => {
				if (cancelled) return;
				handleAuthChange(session); // null 이면 로그아웃 처리됨
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				console.warn(
					"[auth] getSession failed:",
					e instanceof Error ? e.message : e,
				);
				handleAuthChange(null);
			})
			.finally(() => {
				if (!cancelled) setAuthBootstrapDone(true);
			});

		// 2) 이후 이벤트 수신 (로그인/로그아웃/토큰갱신)
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(
			(_event: string, session: Session | null) => {
				handleAuthChange(session);
				setAuthBootstrapDone(true);
			},
		);

		return () => {
			cancelled = true;
			subscription?.unsubscribe();
		};
	}, [handleAuthChange]);

	// 로그인 or 자동 로그인 시 초기 데이터 로드
	// 1) 정상 경로: user?.id 확보 후 hydrate + fetchAll
	// 2) 폴백 경로: 로그인 상태인데 user 정보가 지연되면 fetchAll 1회로 공란 방지
	useEffect(() => {
		if (!authBootstrapDone) return;

		if (!isLoggedIn) {
			initPhaseRef.current = "none";
			setHydrateComplete(false);
			return;
		}

		const runFullInit = async () => {
			// 실제 로그인 직후에만 강제 새로고침. 예전엔 매 새로고침마다 지워서
			// 6시간 캐시를 무시하고 Tavily/Groq를 다시 호출했음 (BACKLOG R1)
			if (openedFromOAuthRedirect) {
				// 이전 세션의 stale 타임스탬프 제거 (로그인 시 "9000분 전" 방지)
				localStorage.removeItem("mb_last_fetched_at");
				localStorage.removeItem("mb_last_access_time");
				useDataStore.setState({ lastFetchedAt: {} });
			}
			try {
				await Promise.all([
					useSettingsStore.getState().hydrateFromDB?.(),
					useWidgetStore.getState().hydrateFromDB?.(),
					useTodoStore.getState().hydrateFromDB?.(),
					useDiaryStore.getState().hydrateFromDB?.(),
					useBriefingHistoryStore.getState().hydrateFromDB?.(),
				]);
			} catch (e: unknown) {
				console.warn(
					"Hydrate failed:",
					e instanceof Error ? e.message : e,
				);
			}
			setHydrateComplete(true);
			// 새 로그인이면 access time이 지워져 isCacheStale()=true → 강제 새로고침,
			// 그냥 새로고침이면 마지막 접속 6시간 이내는 api_cache 사용
			await fetchAll({ useExistingCache: false });
		};

		const runFallbackInit = async () => {
			await fetchAll({ useExistingCache: false });
		};

		if (user?.id) {
			if (initPhaseRef.current === "user") return;
			initPhaseRef.current = "user";
			runFullInit();
			return;
		}

		if (initPhaseRef.current !== "none") return;
		initPhaseRef.current = "fallback";

		const timerId = setTimeout(() => {
			const auth = useAuthStore.getState();
			if (!auth.isLoggedIn || auth.user?.id) return;
			runFallbackInit();
		}, 1200);

		return () => clearTimeout(timerId);
	}, [authBootstrapDone, isLoggedIn, user?.id, fetchAll]);

	// 언어 변경은 useDataStore.js의 i18n.on("languageChanged") 리스너가 처리함

	// 탭이 다시 포커스될 때 캐시 만료(1시간) 확인 → 자동 갱신
	useEffect(() => {
		if (!isLoggedIn) return;
		const handleVisibility = (): void => {
			if (document.visibilityState !== "visible") return;
			if (!useAuthStore.getState().user?.id) return;
			// useExistingCache: true → readApiCache가 1시간 TTL로 판단
			// 만료됐으면 자동으로 API 재호출, 아니면 캐시 사용
			fetchAll({ useExistingCache: true });
		};
		document.addEventListener("visibilitychange", handleVisibility);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibility);
	}, [isLoggedIn, fetchAll]);

	// 주기적 자동 갱신 (5분 interval)
	// 이전에는 visibilitychange + 로그인 시점만 트리거였음 → 탭을 계속 켜두면
	// 1시간이 지나도 자동 새로고침이 안 돼서 "N분 전" 표시가 계속 증가하는 문제.
	// 5분마다 fetchAll({ useExistingCache: true })를 호출하면 readApiCache가
	// 1시간 TTL로 판단해서 만료된 항목만 실제 API로 갱신됨 (캐시 내 항목은 no-op).
	useEffect(() => {
		if (!isLoggedIn || !user?.id) return;
		const POLL_MS = 5 * 60 * 1000;
		const timerId = setInterval(() => {
			if (document.visibilityState !== "visible") return;
			if (!useAuthStore.getState().user?.id) return;
			fetchAll({ useExistingCache: true });
		}, POLL_MS);
		return () => clearInterval(timerId);
	}, [isLoggedIn, user?.id, fetchAll]);


	if (!authBootstrapDone) {
		return (
			<div
				className={`min-h-screen w-full flex items-center justify-center font-sans ${
					isDark
						? "bg-morning-dark-page text-morning-dark-text"
						: "bg-morning-light-page text-morning-light-text"
				}`}
			>
				<p className="text-sm opacity-80">
					{t("common.checking_session")}
				</p>
			</div>
		);
	}

	if (!isLoggedIn) return <LoginScreen />;

	return (
		<div
			className={`min-h-screen w-full font-sans relative transition-colors duration-300 ${
				isDark
					? "bg-morning-dark-page text-morning-dark-text"
					: "bg-morning-light-page text-morning-light-text"
			}`}
			style={{
				backgroundImage: bgImage ? `url(${bgImage})` : "none",
				backgroundSize: "cover",
				backgroundPosition: "center",
				backgroundAttachment: "fixed",
			}}
		>
			<GuestBanner />
			<GoogleReconnectBanner />
			<ExtensionInstallBanner />
			<TopNav />

			{/* v8: 1:3:3 Dashboard Layout Architecture with Widget Scroll Box (REQ-WS-001) */}
			{/* add gap */}
			<div className="h-3" />
			<DashboardLayout />

			{/* Modals & Fixed Components */}
			<Suspense fallback={null}>
				<FixedButtons />
				<OnboardingModal />
				<SettingsModal />
				<FirstLoginBriefingModal />
				<WidgetSettingsModal />
			</Suspense>

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
