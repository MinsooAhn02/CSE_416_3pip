/**
 * 둘러보기(게스트) 모드 — 로그인 없이 샘플 데이터로 대시보드를 보여줌 (포트폴리오/리크루터용).
 * - 네트워크 호출 0: setGuest(true) 이후 Edge Function 헬퍼와 fetch*가 즉시 반환
 * - 스토어에 setState로만 주입 (save() 미사용) → 실제 사용자의 localStorage를 덮지 않음
 * LoginScreen에서 동적 import → 메인 번들에 포함되지 않음.
 */
import i18n from "../l10n/i18n";
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

// 사람이 읽는 문자열만 언어별로 분리. id/날짜/시간/숫자/티커는 아래 코드에서 공통으로 사용.
type Art = [slug: string, title: string, source: string, content: string];
export interface DemoContent {
	weather: { city: string; condition: string };
	events: { title: string; location: string }[]; // demo-1..5 순서 (오늘 3 + 내일 2)
	tasks: string[];
	newsAnswer: string;
	news: Art[];
	trends: string[];
	trendsResults: Art[];
	diary: string;
	notes: string;
	smart: { keyword: string; summaryTitle: string; bullets: string[]; newsTitle: string; items: [slug: string, title: string, source: string][] };
}

const EN: DemoContent = {
	weather: { city: "Seoul", condition: "scattered clouds" },
	events: [
		{ title: "Team stand-up", location: "Zoom" },
		{ title: "Design review: dashboard v2", location: "Room 3B" },
		{ title: "Gym", location: "" },
		{ title: "Dentist appointment", location: "" },
		{ title: "Product demo with mentors", location: "" },
	],
	tasks: ["Finish sprint retro notes", "Reply to recruiter email", "Buy groceries"],
	newsAnswer: "Markets edged higher as investors weighed new inflation data, while AI chip demand kept tech stocks in focus.",
	news: [
		["rates", "Central bank signals a steady path for rates", "Example News", "Policymakers said they expect to keep rates unchanged while inflation cools gradually."],
		["chips", "Chipmakers rally on strong AI server demand", "Example Business", "Shares of major chip designers rose after cloud providers raised their capital spending plans."],
		["bike-lanes", "City unveils new bike lanes ahead of autumn festival", "Example Local", "The city opened 12 km of protected bike lanes connecting downtown and the riverside parks."],
	],
	trends: ["AI coding assistants", "Autumn foliage forecast", "World Cup qualifiers"],
	trendsResults: [
		["ai-coding", "AI coding assistants change how students learn to program", "Example Tech", "Universities are updating coursework as AI pair programmers become common."],
		["foliage", "Peak autumn foliage expected two weeks early this year", "Example Weather", "Warmer nights mean leaves will turn earlier across the central region."],
		["qualifier", "Qualifier recap: late goal secures a crucial win", "Example Sports", "A stoppage-time header kept the team's World Cup hopes alive."],
	],
	diary: "Wrapped up the sprint demo and got good feedback on the new dashboard layout. Went for an evening run by the river and tried a new ramen place afterwards.",
	notes: "Demo went well. Follow up on chart colors.",
	smart: {
		keyword: "Formula 1",
		summaryTitle: "Summary",
		bullets: ["The championship fight tightened to 12 points with six races left.", "Next race: Singapore night race this weekend."],
		newsTitle: "Latest",
		items: [
			["f1-podium", "Rookie scores first podium in a chaotic wet race", "Example Motorsport"],
			["f1-upgrades", "Teams preview new floor upgrades for the final stretch", "Example Racing"],
		],
	},
};

const KO: DemoContent = {
	weather: { city: "서울", condition: "구름 조금" },
	events: [
		{ title: "팀 스탠드업", location: "Zoom" },
		{ title: "디자인 리뷰: 대시보드 v2", location: "3B 회의실" },
		{ title: "헬스장", location: "" },
		{ title: "치과 예약", location: "" },
		{ title: "멘토와 제품 데모", location: "" },
	],
	tasks: ["스프린트 회고 노트 마무리", "채용 담당자 메일 답장", "장보기"],
	newsAnswer: "투자자들이 새 물가 지표를 주시하면서 증시가 소폭 상승했고, AI 반도체 수요가 기술주의 관심을 이어갔습니다.",
	news: [
		["rates", "중앙은행, 완만한 금리 기조 시사", "예시 뉴스", "통화당국은 물가가 점진적으로 안정되는 동안 금리를 동결할 것으로 본다고 밝혔습니다."],
		["chips", "AI 서버 수요 급증에 반도체주 강세", "예시 경제", "클라우드 업체들이 설비투자 계획을 늘리면서 주요 반도체 설계 기업의 주가가 올랐습니다."],
		["bike-lanes", "가을 축제 앞두고 새 자전거 도로 개통", "예시 지역뉴스", "시는 도심과 강변 공원을 잇는 12km 구간의 보호 자전거 도로를 열었습니다."],
	],
	trends: ["AI 코딩 도우미", "단풍 예상 시기", "월드컵 예선"],
	trendsResults: [
		["ai-coding", "AI 코딩 도우미가 바꾸는 학생들의 프로그래밍 학습", "예시 테크", "AI 페어 프로그래머가 보편화되면서 대학들이 교과 과정을 개편하고 있습니다."],
		["foliage", "올해 단풍, 평년보다 2주 일찍 절정 예상", "예시 날씨", "따뜻한 밤이 이어지면서 중부 지역 단풍이 더 일찍 물들 전망입니다."],
		["qualifier", "예선 리뷰: 막판 결승골로 값진 승리", "예시 스포츠", "추가시간 헤딩골로 대표팀의 월드컵 희망이 이어졌습니다."],
	],
	diary: "스프린트 데모를 마무리했고 새 대시보드 레이아웃에 좋은 피드백을 받았다. 저녁에는 강변에서 러닝을 하고, 새로 생긴 라멘집에 들렀다.",
	notes: "데모 잘 끝남. 차트 색상 후속 작업 필요.",
	smart: {
		keyword: "포뮬러 1",
		summaryTitle: "요약",
		bullets: ["남은 6개 레이스를 앞두고 챔피언십 격차가 12점으로 좁혀졌습니다.", "다음 경기: 이번 주말 싱가포르 야간 레이스."],
		newsTitle: "최신 소식",
		items: [
			["f1-podium", "루키, 혼전의 우천 레이스에서 첫 포디움", "예시 모터스포츠"],
			["f1-upgrades", "팀들, 시즌 막바지를 위한 새 플로어 업그레이드 공개", "예시 레이싱"],
		],
	},
};

export const getDemoContent = (lang?: string): DemoContent => ((lang ?? "").startsWith("ko") ? KO : EN);

const article = ([slug, title, source, content]: Art) => ({
	title,
	url: `https://example.com/${slug}`,
	content,
	image: null,
	published_date: null,
	source,
});

// 언어는 진입 시점에 한 번만 결정 (게스트 중 언어 전환 시 재적용 훅은 없음).
export const enterGuestMode = (lang: string = i18n.language): void => {
	setGuest(true);
	const c = getDemoContent(lang);

	const today = formatLocalDate();
	const tomorrow = shiftDateString(today, 1);
	const yesterday = shiftDateString(today, -1);
	const now = Date.now();

	const todayEvents = [
		makeEvent("demo-1", today, c.events[0].title, "09:30", "10:00", c.events[0].location),
		makeEvent("demo-2", today, c.events[1].title, "13:00", "14:00", c.events[1].location),
		makeEvent("demo-3", today, c.events[2].title, "18:30", "19:30", c.events[2].location),
	];
	const tomorrowEvents = [
		makeEvent("demo-4", tomorrow, c.events[3].title, "10:00", "10:45", c.events[3].location),
		makeEvent("demo-5", tomorrow, c.events[4].title, "15:00", "16:00", c.events[4].location),
	];
	const tasks = [
		makeTask("demo-t1", today, c.tasks[0]),
		makeTask("demo-t2", today, c.tasks[1]),
		makeTask("demo-t3", today, c.tasks[2], true),
	];
	const toBasic = (e: CalendarEvent) => ({ id: e.id, title: e.title, start: e.start ?? "", end: e.end ?? "", location: e.location });

	const userStocks = ["AAPL", "NVDA", "TSLA", "MSFT"];
	useSettingsStore.setState({ stockSymbols: userStocks, showFirstLoginModal: false });
	useOnboardingStore.setState({ onboarded: true, showOnboarding: false, perms: { fit: true, cal: true } });

	useDataStore.setState({
		activeWidgetIds: Object.keys(DEFAULT_VIS).filter((k) => (DEFAULT_VIS as Record<string, boolean>)[k]),
		weather: {
			temp: 18,
			city: c.weather.city,
			condition: c.weather.condition,
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
		newsAnswer: c.newsAnswer,
		newsResults: c.news.map(article),
		trends: c.trends,
		trendsResults: c.trendsResults.map(article),
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

	const yesterdayDiary = c.diary;
	useDiaryStore.setState((s) => ({
		entries: {
			...s.entries,
			[yesterday]: {
				diary: yesterdayDiary,
				aiGeneratedDiary: yesterdayDiary,
				editedDiary: "",
				notes: c.notes,
				memo: c.notes,
				feedback: { rating: null, history: [], pendingRewrite: null, confirmedAt: null },
			},
		},
	}));

	const smartKeyword = c.smart.keyword;
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
				title: c.smart.summaryTitle,
				lines: [],
				bullets: c.smart.bullets,
			},
			{
				id: "news",
				type: "news",
				title: c.smart.newsTitle,
				lines: [],
				items: c.smart.items.map(([slug, title, source]) => ({ title, url: `https://example.com/${slug}`, source })),
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
