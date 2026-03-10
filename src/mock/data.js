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

// Mock fetch 함수들 - 나중에 실제 API로 교체 가능
export function fetchWeather() {
	return new Promise((resolve) => {
		setTimeout(() => resolve(mockWeather), 300);
	});
}

export function fetchStocks() {
	return new Promise((resolve) => {
		setTimeout(() => resolve(mockStocks), 300);
	});
}

export function fetchTrends() {
	return new Promise((resolve) => {
		setTimeout(() => resolve(mockTrends), 300);
	});
}

export function fetchBriefing() {
	return new Promise((resolve) => {
		setTimeout(() => resolve(mockBriefing), 500);
	});
}
