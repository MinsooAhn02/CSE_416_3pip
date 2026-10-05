import { beforeEach, describe, expect, it, vi } from "vitest";

interface EdgeRes {
	ok: boolean;
	status: number;
	data: unknown;
	raw: string;
	error: string | null;
	errorType: null;
	timedOut: boolean;
	elapsedMs: number;
}

const okRes = (data: unknown): EdgeRes => ({
	ok: true,
	status: 200,
	data,
	raw: "",
	error: null,
	errorType: null,
	timedOut: false,
	elapsedMs: 1,
});

const deferred = <T,>() => {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
};

const enArticle = (n: number) => ({
	title: `Senate passes sweeping budget bill number ${n}`,
	url: `https://www.reuters.com/world/us/budget-${n}`,
	content: "Lawmakers voted late on Tuesday after weeks of negotiation over spending levels.",
});
const koArticle = (n: number) => ({
	title: `국회 예산안 본회의 통과 ${n}번째 소식`,
	url: `https://www.yna.co.kr/view/AKR2026100${n}`,
	content: "국회는 화요일 늦게 예산안을 처리했다.",
});

const batch = (...results: unknown[][]) => okRes({ batch: results.map((r) => ({ results: r, answer: null })) });

// 각 테스트마다 모듈 그래프를 새로 만든다 (스토어의 모듈 레벨 상태·i18n 구독 격리)
const setup = async (tavily: (call: number) => Promise<EdgeRes>) => {
	vi.resetModules();
	let calls = 0;
	const callEdge = vi.fn(async (name: string) => (name === "tavily" ? tavily(calls++) : null));
	vi.doMock("../lib/edge", () => ({ callEdge }));
	vi.spyOn(console, "warn").mockImplementation(() => {});
	const i18n = (await import("../l10n/i18n")).default;
	await i18n.changeLanguage("en");
	const { useDataStore } = await import("./useDataStore");
	const tavilyCalls = () => callEdge.mock.calls.filter((c) => c[0] === "tavily");
	return { i18n, useDataStore, callEdge, tavilyCalls };
};

beforeEach(() => {
	localStorage.clear();
});

describe("useDataStore.fetchNews", () => {
	it("sets newsResults from the Tavily batch response", async () => {
		const { useDataStore, tavilyCalls } = await setup(async () => batch([enArticle(1), enArticle(2)], [enArticle(3)]));
		await useDataStore.getState().fetchNews(undefined, true);

		const s = useDataStore.getState();
		expect(tavilyCalls()).toHaveLength(1);
		expect(s.newsResults.map((a) => a.url)).toEqual([
			"https://www.reuters.com/world/us/budget-1",
			"https://www.reuters.com/world/us/budget-2",
			"https://www.reuters.com/world/us/budget-3",
		]);
		expect(s.apiStatus.news).toBe("ok");
		expect(s.fetchedLanguage.news).toBe("en");
		expect(s.loading.news).toBe(false);
		expect(s.errors.news).toBeNull();
	});

	it("marks an error (and empties results) when the batch has no usable data", async () => {
		const { useDataStore } = await setup(async () => okRes({ batch: [{ error: "rate limit" }, { error: "rate limit" }] }));
		await useDataStore.getState().fetchNews(undefined, true);
		const s = useDataStore.getState();
		expect(s.newsResults).toEqual([]);
		expect(s.apiStatus.news).toBe("error");
		expect(s.loading.news).toBe(false);
	});

	it("drops an English response that arrives after switching to Korean", async () => {
		const en = deferred<EdgeRes>();
		const { i18n, useDataStore, tavilyCalls } = await setup(() => en.promise);

		const pending = useDataStore.getState().fetchNews(undefined, true);
		await vi.waitFor(() => expect(tavilyCalls()).toHaveLength(1));
		// apiStatus.news가 아직 null이므로 languageChanged 구독은 자체 재조회를 시작하지 않는다
		await i18n.changeLanguage("ko");
		expect(tavilyCalls()).toHaveLength(1);

		en.resolve(batch([enArticle(1), enArticle(2)], [enArticle(3)]));
		await pending;

		const s = useDataStore.getState();
		expect(s.newsResults).toEqual([]);
		expect(s.apiStatus.news).toBeUndefined();
		expect(s.fetchedLanguage.news).toBeUndefined();
		expect(s.loading.news).toBe(false); // finally 블록은 그대로 실행
	});

	it("keeps the Korean result when a stale English response lands after the language-triggered refetch", async () => {
		const en = deferred<EdgeRes>();
		const ko = deferred<EdgeRes>();
		const { i18n, useDataStore, tavilyCalls } = await setup((call) => (call === 0 ? en.promise : ko.promise));

		// news가 이미 한 번 로드된 상태여야 언어 전환 구독이 자체 fetchNews(ko)를 시작한다
		useDataStore.getState().setApiStatus("news", "ok");
		const pendingEn = useDataStore.getState().fetchNews(undefined, true);
		await vi.waitFor(() => expect(tavilyCalls()).toHaveLength(1));
		await i18n.changeLanguage("ko");
		await vi.waitFor(() => expect(tavilyCalls()).toHaveLength(2)); // 구독이 시작한 ko 요청

		ko.resolve(batch([koArticle(1), koArticle(2)], [koArticle(3)]));
		await vi.waitFor(() => expect(useDataStore.getState().newsResults.length).toBe(3));
		en.resolve(batch([enArticle(1), enArticle(2)], [enArticle(3)]));
		await pendingEn;

		const s = useDataStore.getState();
		expect(s.newsResults.map((a) => a.url)).toEqual([
			"https://www.yna.co.kr/view/AKR20261001",
			"https://www.yna.co.kr/view/AKR20261002",
			"https://www.yna.co.kr/view/AKR20261003",
		]);
		expect(s.fetchedLanguage.news).toBe("ko");
	});
});
