// Mock 데이터 서비스 - 실제 API 연동 전까지 사용할 더미 데이터

export const mockWeather = {
	city: "서울",
	temp: 18,
	condition: "맑음",
	precipitation: 0,
	airQuality: "좋음",
	humidity: 45,
	wind: "3.2m/s",
};

export const mockStocks = [
	{ name: "KOSPI", value: "2,754.89", change: "+0.42%", up: true },
	{ name: "NASDAQ", value: "16,384.47", change: "-0.12%", up: false },
	{ name: "S&P 500", value: "5,234.18", change: "+0.28%", up: true },
	{ name: "USD/KRW", value: "1,322.50", change: "-0.15%", up: false },
];

export const mockTrends = [
	"#엔비디아_실적",
	"#벚꽃_개화시기",
	"#금리동결",
	"#GPT-5_루머",
	"#신상_맛집",
	"#CSE416_프로젝트",
	"#크롬_익스텐션",
];

export const mockTodos = [
	{ id: 1, text: "CSE 416 프로젝트 회의", completed: false },
	{ id: 2, text: "시스템 아키텍처 설계 초안 작성", completed: true },
	{ id: 3, text: "Gemini API 연결 테스트", completed: false },
];

export const mockBookmarks = [
	{ name: "Google", icon: "G", url: "https://google.com" },
	{ name: "Naver", icon: "N", url: "https://naver.com" },
	{ name: "GitHub", icon: "GH", url: "https://github.com" },
	{ name: "YouTube", icon: "YT", url: "https://youtube.com" },
];

export const mockBriefing = {
	ready: true,
	summary: "오늘의 AI 브리핑이 준비되었습니다.",
	detail:
		"오늘 나스닥 지수가 소폭 하락했으며, 서울 날씨는 맑고 미세먼지 좋음입니다. CSE 416 프로젝트 마감이 2주 남았습니다.",
};

// 캘린더 Mock 데이터 (Google Calendar 연동 placeholder)
export const mockCalendarEvents = [
	{
		time: "09:00",
		title: "CSE 416 팀 미팅",
		location: "Zoom",
		color: "#4f46e5",
	},
	{
		time: "11:30",
		title: "점심 약속",
		location: "학교 식당",
		color: "#10b981",
	},
	{
		time: "14:00",
		title: "라이브러리 스터디",
		location: "도서관 3층",
		color: "#f59e0b",
	},
	{
		time: "18:00",
		title: "헬스장 운동",
		location: "캠퍼스 짐",
		color: "#ef4444",
	},
];

// 건강 Mock 데이터 (Google Fit 연동 placeholder)
export const mockHealthData = {
	steps: 6842,
	stepsGoal: 10000,
	sleep: 6.5,
	sleepGoal: 8,
	calories: 1840,
	caloriesGoal: 2200,
	heartRate: 72,
	water: 5,
	waterGoal: 8,
};

// 브랜드 발매 Mock 데이터
export const mockBrandDrops = [
	{
		brand: "Nike",
		product: "Air Max DN 'Volt'",
		date: "2026-03-20",
		emoji: "🟢",
	},
	{
		brand: "Supreme",
		product: "SS26 Week 4 Drop",
		date: "2026-03-14",
		emoji: "🔴",
	},
	{
		brand: "Adidas",
		product: "Yeezy Boost 380",
		date: "2026-03-25",
		emoji: "⚪",
	},
	{
		brand: "New Balance",
		product: "993 Made in USA",
		date: "2026-04-01",
		emoji: "🔵",
	},
	{
		brand: "Jordan",
		product: "AJ1 Retro 'Chicago'",
		date: "2026-04-10",
		emoji: "🏀",
	},
];

// 음식 룰렛 데이터
export const mockFoods = [
	"김치찌개",
	"된장찌개",
	"비빔밥",
	"떡볶이",
	"치킨",
	"피자",
	"초밥",
	"라멘",
	"칼국수",
	"곱창",
	"삼겹살",
	"제육볶음",
	"냉면",
	"불고기",
	"돈까스",
	"카레",
];

// 주변 맛집 Mock 데이터
export const mockRestaurants = [
	{
		name: "맛있는 김치찌개집",
		rating: 4.5,
		distance: "350m",
		category: "한식",
		price: "₩8,000",
	},
	{
		name: "스시 오마카세 하루",
		rating: 4.8,
		distance: "500m",
		category: "일식",
		price: "₩15,000",
	},
	{
		name: "피자 나폴리",
		rating: 4.2,
		distance: "200m",
		category: "양식",
		price: "₩12,000",
	},
	{
		name: "홍콩반점",
		rating: 4.0,
		distance: "150m",
		category: "중식",
		price: "₩7,000",
	},
	{
		name: "써브웨이 캠퍼스점",
		rating: 3.9,
		distance: "100m",
		category: "샌드위치",
		price: "₩6,500",
	},
];

// 톤별 브리핑 Mock 데이터
export const mockBriefings = {
	friendly: {
		summary: "좋은 아침이에요! 오늘 브리핑 준비됐어요 ☀️",
		detail:
			"오늘 날씨 정말 좋아요! 나스닥이 살짝 내려갔지만 걱정 마세요. CSE 416 프로젝트 마감이 2주 남았으니 오늘 조금씩 진행해보는 건 어떨까요? 어제 수면이 6.5시간으로 부족했으니 카페인 한 잔 챙기시고, 오후에는 가벼운 산책으로 집중력을 높여보세요!",
	},
	professional: {
		summary: "금일 브리핑이 준비되었습니다.",
		detail:
			"NASDAQ -0.12% 하락, KOSPI +0.42% 상승. 서울 기온 18°C, 강수확률 0%. CSE 416 프로젝트 잔여일 14일. 전일 수면 6.5시간으로 권장량 대비 부족. 오후 집중 업무 시간 확보를 권장드립니다.",
	},
	humorous: {
		summary: "일어나세요! AI가 세상 소식을 가져왔어요 🤖",
		detail:
			"주식시장은 오늘도 롤러코스터 🎢 나스닥이 살짝 미끄러졌어요. 날씨는 완벽한 '밖에 나가기 좋은 날'인데... CSE 416 마감이 2주 남았다는 건 안 비밀! 어제 수면이 부족했으니 오늘은 커피 한 잔의 힘을 빌려봅시다 ☕",
	},
};

// 스마트 위젯 Mock 데이터 (키워드 기반 동적 위젯)
export const mockSmartWidgets = {
	카메라: {
		keyword: "카메라",
		emoji: "📷",
		lastUpdated: "2분 전",
		refreshInterval: 300000,
		sections: [
			{
				type: "price",
				title: "인기 카메라 가격 비교",
				items: [
					{
						name: "Sony A7 IV",
						price: "₩2,499,000",
						change: "-3.2%",
						source: "다나와",
					},
					{
						name: "Canon R6 Mark II",
						price: "₩2,799,000",
						change: "+1.1%",
						source: "쿠팡",
					},
					{
						name: "Nikon Z6 III",
						price: "₩2,299,000",
						change: "-5.0%",
						source: "네이버",
					},
				],
			},
			{
				type: "trend",
				title: "관련 트렌드",
				tags: ["#풀프레임미러리스", "#소니신제품", "#카메라추천2026"],
			},
			{
				type: "news",
				title: "최신 뉴스",
				items: [
					{
						title: "Sony A9 III 펌웨어 업데이트 발표",
						source: "디지털타임스",
						time: "3시간 전",
					},
					{
						title: "2026 봄 카메라 추천 TOP 5",
						source: "IT동아",
						time: "5시간 전",
					},
				],
			},
		],
	},
	노트북: {
		keyword: "노트북",
		emoji: "💻",
		lastUpdated: "5분 전",
		refreshInterval: 600000,
		sections: [
			{
				type: "price",
				title: "인기 노트북 가격 비교",
				items: [
					{
						name: "MacBook Pro 14 M4",
						price: "₩2,390,000",
						change: "-2.1%",
						source: "Apple",
					},
					{
						name: "LG 그램 16 (2026)",
						price: "₩1,890,000",
						change: "-4.5%",
						source: "다나와",
					},
					{
						name: "삼성 갤럭시 북4 Pro",
						price: "₩1,690,000",
						change: "+0.8%",
						source: "쿠팡",
					},
				],
			},
			{
				type: "trend",
				title: "관련 트렌드",
				tags: ["#M4맥북", "#대학생노트북추천", "#가성비노트북"],
			},
			{
				type: "news",
				title: "최신 뉴스",
				items: [
					{
						title: "Apple M4 Ultra 칩 성능 벤치마크 공개",
						source: "매일경제",
						time: "1시간 전",
					},
					{
						title: "2026 대학생 노트북 구매 가이드",
						source: "IT조선",
						time: "4시간 전",
					},
				],
			},
		],
	},
};

// Mock fetch 함수들 - 나중에 실제 API로 교체 가능
export function fetchWeather() {
	return new Promise((resolve) => setTimeout(() => resolve(mockWeather), 300));
}

export function fetchStocks() {
	return new Promise((resolve) => setTimeout(() => resolve(mockStocks), 300));
}

export function fetchTrends() {
	return new Promise((resolve) => setTimeout(() => resolve(mockTrends), 300));
}

export function fetchRestaurants() {
	return new Promise((resolve) =>
		setTimeout(() => resolve(mockRestaurants), 300),
	);
}

export function fetchBriefing() {
	return new Promise((resolve) => setTimeout(() => resolve(mockBriefing), 500));
}

export function fetchCalendarEvents() {
	return new Promise((resolve) =>
		setTimeout(() => resolve(mockCalendarEvents), 400),
	);
}

export function fetchHealthData() {
	return new Promise((resolve) =>
		setTimeout(() => resolve(mockHealthData), 400),
	);
}
