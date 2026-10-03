/**
 * 둘러보기(게스트) 모드 — 로그인 없이 샘플 데이터로 대시보드를 보여줌 (포트폴리오/리크루터용).
 * - 네트워크 호출 0: setGuest(true) 이후 Edge Function 헬퍼와 fetch*가 즉시 반환
 * - 스토어에 setState로만 주입 (save() 미사용) → 실제 사용자의 localStorage를 덮지 않음
 * LoginScreen에서 동적 import → 메인 번들에 포함되지 않음.
 */
import { setGuest } from "../lib/guest";
import { formatLocalDate, shiftDateString } from "../utils/date";
import { DEFAULT_VIS } from "../constants";
import { useAuthStore } from "../store/useAuthStore";
import { useDataStore } from "../store/useDataStore";
import { useGoogleCalendarStore } from "../store/useGoogleCalendarStore";
import type { CalendarEvent, Task } from "../store/useGoogleCalendarStore";
import { useTodoStore } from "../store/useTodoStore";
import { useDiaryStore } from "../store/useDiaryStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useOnboardingStore } from "../store/useOnboardingStore";
import { getSmartWidgetCacheKey, useWidgetStore } from "../store/useWidgetStore";

const at = (date: string, hhmm: string): string => new Date(`${date}T${hhmm}:00`).toISOString();

const makeEvent = (id: string, date: string, title: string, start: string, end: string, location = ""): CalendarEvent => ({
	id,
	title,
	date,
	startTime: start,
	endTime: end,
	start: at(date, start),
	end: at(date, end),
	allDay: false,
	location,
	description: "",
	attendees: [],
	visibility: "default",
	availability: "busy",
	meetLink: "",
	addGoogleMeet: false,
	conferenceStatus: null,
	remindersUseDefault: true,
	reminderOverrides: [],
	sendUpdates: false,
	recurrence: [],
	repeat: null,
	recurringEventId: null,
	originalStartTime: null,
	seriesEventId: null,
});

const makeTask = (id: string, date: string, title: string, completed = false): Task => ({
	id,
	taskListId: "@default",
	title,
	text: title,
	date,
	due: at(date, "00:00"),
	description: "",
	completed,
	completedAt: "",
	notes: "",
	updated: null,
});

const article = (title: string, source: string, content: string) => ({
	title,
	url: `https://example.com/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, "-"))}`,
	content,
	image: null,
	published_date: null,
	source,
});

export const enterGuestMode = (): void => {
	setGuest(true);

	const today = formatLocalDate();
	const tomorrow = shiftDateString(today, 1);
	const yesterday = shiftDateString(today, -1);
	const now = Date.now();

	const todayEvents = [
		makeEvent("demo-1", today, "Team stand-up", "09:30", "10:00", "Zoom"),
		makeEvent("demo-2", today, "Design review: dashboard v2", "13:00", "14:00", "Room 3B"),
		makeEvent("demo-3", today, "Gym", "18:30", "19:30"),
	];
	const tomorrowEvents = [
		makeEvent("demo-4", tomorrow, "Dentist appointment", "10:00", "10:45"),
		makeEvent("demo-5", tomorrow, "Product demo with mentors", "15:00", "16:00"),
	];
	const tasks = [
		makeTask("demo-t1", today, "Finish sprint retro notes"),
		makeTask("demo-t2", today, "Reply to recruiter email"),
		makeTask("demo-t3", today, "Buy groceries", true),
	];
	const toBasic = (e: CalendarEvent) => ({ id: e.id, title: e.title, start: e.start ?? "", end: e.end ?? "", location: e.location });

	const userStocks = ["AAPL", "NVDA", "TSLA", "MSFT"];
	useSettingsStore.setState({ stockSymbols: userStocks, showFirstLoginModal: false });
	useOnboardingStore.setState({ onboarded: true, showOnboarding: false, perms: { fit: true, cal: true } });

	useDataStore.setState({
		activeWidgetIds: Object.keys(DEFAULT_VIS).filter((k) => (DEFAULT_VIS as Record<string, boolean>)[k]),
		weather: {
			temp: 18,
			city: "Seoul",
			condition: "scattered clouds",
			conditionId: 802,
			precipitation: 10,
			airQualityIndex: 2,
			humidity: 55,
			icon: "03d",
		},
		stocks: [
			{ symbol: "SP500", name: "S&P 500", value: "6,512.30", change: "0.42%", up: true, type: "index" },
			{ symbol: "KOSPI", name: "KOSPI", value: "3,185.12", change: "0.87%", up: true, type: "index" },
			{ symbol: "NASDAQ", name: "NASDAQ", value: "21,804.55", change: "0.31%", up: false, type: "index" },
			{ symbol: "USDKRW", name: "USD/KRW", value: "1,372.40", change: "0.12%", up: false, type: "currency" },
			{ symbol: "VIX", name: "VIX", value: "15.82", change: "2.10%", up: false, type: "index" },
			{ symbol: "CRUDE", name: "WTI Crude", value: "71.25", change: "1.05%", up: true, type: "index" },
			{ symbol: "DXY", name: "Dollar Index", value: "101.44", change: "0.08%", up: true, type: "index" },
			{ symbol: "DJI", name: "Dow Jones", value: "44,210.70", change: "0.22%", up: true, type: "index" },
			{ symbol: "AAPL", name: "Apple", value: "232.15", change: "1.24%", up: true, currency: "USD" },
			{ symbol: "NVDA", name: "NVIDIA", value: "141.88", change: "2.37%", up: true, currency: "USD" },
			{ symbol: "TSLA", name: "Tesla", value: "248.60", change: "1.65%", up: false, currency: "USD" },
			{ symbol: "MSFT", name: "Microsoft", value: "438.02", change: "0.54%", up: true, currency: "USD" },
		],
		newsAnswer: "Markets edged higher as investors weighed new inflation data, while AI chip demand kept tech stocks in focus.",
		newsResults: [
			article("Central bank signals a steady path for rates", "Example News", "Policymakers said they expect to keep rates unchanged while inflation cools gradually."),
			article("Chipmakers rally on strong AI server demand", "Example Business", "Shares of major chip designers rose after cloud providers raised their capital spending plans."),
			article("City unveils new bike lanes ahead of autumn festival", "Example Local", "The city opened 12 km of protected bike lanes connecting downtown and the riverside parks."),
		],
		trends: ["AI coding assistants", "Autumn foliage forecast", "World Cup qualifiers"],
		trendsResults: [
			article("AI coding assistants change how students learn to program", "Example Tech", "Universities are updating coursework as AI pair programmers become common."),
			article("Peak autumn foliage expected two weeks early this year", "Example Weather", "Warmer nights mean leaves will turn earlier across the central region."),
			article("Qualifier recap: late goal secures a crucial win", "Example Sports", "A stoppage-time header kept the team's World Cup hopes alive."),
		],
		calEvents: todayEvents.map(toBasic),
		tomorrowEvents: tomorrowEvents.map(toBasic),
		healthData: {
			steps: 6240,
			stepsGoal: 10000,
			sleep: 7.2,
			sleepGoal: 8,
			calories: 1850,
			caloriesGoal: 2200,
			heartRate: 68,
			water: 5,
			waterGoal: 8,
		},
		lastFetchedAt: { weather: now, stocks: now, news: now, trends: now, health: now },
		initialFetchDone: true, // 브리핑 위젯이 샘플 데이터로 바로 생성 (Groq는 차단 → 로컬 문구)
	});

	useGoogleCalendarStore.setState({
		events: [...todayEvents, ...tomorrowEvents],
		tasks,
		tasksLoaded: true,
		loadedMonthKey: today.slice(0, 7), // 마운트 시 fetchEventsAndTasks가 덮어쓰지 않게
	});
	useTodoStore.setState({
		todos: tasks.map((t) => ({
			id: t.id ?? "",
			text: t.title,
			title: t.title,
			completed: t.completed,
			date: t.date,
			description: "",
			taskListId: t.taskListId,
		})),
	});

	const yesterdayDiary =
		"Wrapped up the sprint demo and got good feedback on the new dashboard layout. Went for an evening run by the river and tried a new ramen place afterwards.";
	useDiaryStore.setState((s) => ({
		entries: {
			...s.entries,
			[yesterday]: {
				diary: yesterdayDiary,
				aiGeneratedDiary: yesterdayDiary,
				editedDiary: "",
				notes: "Demo went well. Follow up on chart colors.",
				memo: "Demo went well. Follow up on chart colors.",
				feedback: { rating: null, history: [], pendingRewrite: null, confirmedAt: null },
			},
		},
	}));

	const smartKeyword = "Formula 1";
	const smartData = {
		keyword: smartKeyword,
		emoji: "🏎️",
		category: "sports",
		lastUpdated: new Date(now).toISOString(),
		lastUpdatedAt: new Date(now).toISOString(),
		sections: [
			{
				id: "summary",
				type: "summary",
				title: "Summary",
				lines: [],
				bullets: [
					"The championship fight tightened to 12 points with six races left.",
					"Next race: Singapore night race this weekend.",
				],
			},
			{
				id: "news",
				type: "news",
				title: "Latest",
				lines: [],
				items: [
					{ title: "Rookie scores first podium in a chaotic wet race", url: "https://example.com/f1-podium", source: "Example Motorsport" },
					{ title: "Teams preview new floor upgrades for the final stretch", url: "https://example.com/f1-upgrades", source: "Example Racing" },
				],
			},
		],
	};
	useWidgetStore.setState((s) => ({
		smartKeywords: [smartKeyword],
		smartWidgetData: {
			...s.smartWidgetData,
			[getSmartWidgetCacheKey(smartKeyword, "en")]: smartData,
			[getSmartWidgetCacheKey(smartKeyword, "ko")]: smartData,
		},
	}));

	// 마지막: 대시보드로 전환 (위 스토어가 채워진 뒤 렌더)
	useAuthStore.setState({ isLoggedIn: true });
};
