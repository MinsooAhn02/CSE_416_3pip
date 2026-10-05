import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { isGuest } from "../lib/guest";
import { load, save } from "../utils/storage";
import { DEFAULT_VIS } from "../constants";
import { formatLocalDate, shiftDateString } from "../utils/date";
import { getInterestFingerprint, getTopInterestKeywords } from "../utils/interests";
import { useSettingsStore } from "./useSettingsStore";
import { useAuthStore } from "./useAuthStore";
import { useOnboardingStore } from "./useOnboardingStore";
import i18n from "../l10n/i18n";
import { handleApiError } from "../utils/errorHandler";
import { _trendsMemCache, setLastAccessTime, isCacheStale, cached, cacheIt, getUserId, readApiCache, warmupTrendsMemCache, writeApiCache } from "./data/apiCache";
import { KO_NEWS_DOMAINS, EN_NEWS_DOMAINS, normalizeArticleList, dedupeArticles, filterLocalizedArticles } from "./data/articles";
import { invokeEdgeDetailed, invokeEdge } from "./data/edge";
import { resolveAppLanguage, getErrorText, getTavilyErrorMessage } from "./data/errors";
import { getGeoPosition } from "./data/geo";
import { extractLayoutWidgetIds, defaultStockSymbols, normalizeStockSymbols, normalizeGroqWeather, RawStockRow, normalizeStockItem, hasMeaningfulStockValues, pickBestStockRowsForSymbols, normalizeHealthData, getGoogleHealthErrorMessage } from "./data/normalize";
import { translateArticlesToKorean, buildLocalizedTrendTitles, shouldBackfillKoreanCache } from "./data/translate";
import { WeatherData, StockItem, ArticleItem, HealthData, ManualCity, CalendarEventBasic } from "./data/types";
export type { WeatherData, StockItem, ArticleItem, HealthData, ManualCity, CalendarEventBasic } from "./data/types";

interface DataState {
	weather: WeatherData | null;
	stocks: StockItem[];
	trends: string[];
	trendsResults: ArticleItem[];
	newsAnswer: string | null;
	newsResults: ArticleItem[];
	calEvents: CalendarEventBasic[];
	tomorrowEvents: CalendarEventBasic[];
	healthData: HealthData | null;
	rawData: { weather: unknown; stocks: unknown };
	onboardingProfile: { age: number | string | null; interests: string[]; persona: string | null } | null;
	activeWidgetIds: string[];
	usingDefaultWeatherLocation: boolean;
	manualWeatherCity: ManualCity | null;
	loading: Record<string, boolean>;
	errors: Record<string, string | null>;
	apiStatus: Record<string, "ok" | "error" | null>;
	fetchedLanguage: Record<string, string>;
	lastFetchedAt: Record<string, number>;
	initialFetchDone: boolean;

	setActiveWidgetIds: (ids: string[]) => void;
	setApiStatus: (key: string, status: "ok" | "error" | null) => void;
	markFetched: (key: string, ts?: number | null) => void;
	getLastUpdatedMinutes: (key: string) => number | null;
	clearFeedForLanguageSwitch: () => void;

	setManualWeatherCity: (city: string | null) => Promise<{ ok: boolean; error?: string }>;
	fetchWeather: (
		latArg?: number | null,
		lonArg?: number | null,
		userId?: string | null,
		force?: boolean,
	) => Promise<void>;

	fetchStocks: (
		symbols?: string[],
		userId?: string | null,
		force?: boolean,
	) => Promise<void>;
	validateStockSymbol: (symbol: string) => Promise<boolean>;

	fetchTrends: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchNews: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchCalendar: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchTomorrowCalendar: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchHealth: (userId?: string | null, force?: boolean) => Promise<void>;
	fetchAll: (options?: { useExistingCache?: boolean }) => Promise<void>;
}

/* ══════════════════════════════════════════════
   Store
   ══════════════════════════════════════════════ */
export const useDataStore = create<DataState>()((set, get) => ({
	weather: null,
	stocks: [],
	trends: [],
	trendsResults: [],
	newsAnswer: null,
	newsResults: [],
	calEvents: [],
	tomorrowEvents: [],
	healthData: null,
	rawData: {
		weather: null,
		stocks: null,
	},
	onboardingProfile: null,
	activeWidgetIds: [],
	usingDefaultWeatherLocation: false,
	manualWeatherCity: load("mb_manual_city", null),
	loading: {},
	errors: {},
	/* Per-key API health for the temporary status indicator:
	 * "ok" = real API data loaded (from network or fresh cache)
	 * "error" = request failed (even if mock fallback is showing)
	 * null = never attempted */
	apiStatus: {},
	fetchedLanguage: {},   // { news: "ko", trends: "ko" } — 마지막 fetch 시 언어
	lastFetchedAt: load("mb_last_fetched_at", {}),
	initialFetchDone: false, // 첫 fetchAll 완료 여부 — 브리핑이 일부 데이터만으로 생성되는 것 방지
	setActiveWidgetIds: (ids) => set({ activeWidgetIds: ids }),
	setApiStatus: (key, status) =>
		set((s) => ({ apiStatus: { ...s.apiStatus, [key]: status } })),
	markFetched: (key, ts) =>
		set((s) => {
			const next = { ...s.lastFetchedAt, [key]: ts ?? Date.now() };
			save("mb_last_fetched_at", next);
			return { lastFetchedAt: next };
		}),
	getLastUpdatedMinutes: (key) => {
		const ts = get().lastFetchedAt?.[key];
		if (!ts) return null;
		const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
		return Number.isFinite(mins) ? mins : null;
	},

	/* 언어 전환 시 뉴스/트렌드 즉시 초기화 — 새 언어로 fetch 전까지 빈 상태 유지 */
	clearFeedForLanguageSwitch: () =>
		set((s) => ({
			newsResults: [],
			trendsResults: [],
			loading: { ...s.loading, news: true, trends: true },
			errors: { ...s.errors, news: null, trends: null },
		})),

	/* ══════════════════════════════════════════
	   날씨 (Weather)
	   - OpenWeatherMap API (실제 날씨 데이터)
	   - 브라우저 Geolocation으로 현재 위치 자동 감지
	   - 실패 시 mock fallback
	   ══════════════════════════════════════════ */
	setManualWeatherCity: async (city) => {
		const trimmed = city?.trim() || null;
		if (!trimmed) {
			save("mb_manual_city", null);
			set({ manualWeatherCity: null });
			return { ok: true };
		}
		// Nominatim으로 도시명 → 좌표 변환 (무료, 키 불필요)
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1`,
				{ headers: { "Accept-Language": "en" } },
			);
			const results = await res.json() as { lat: string; lon: string; display_name: string }[];
			if (!results?.length) {
				return {
					ok: false,
					error: getErrorText(
						"city_not_found",
						{ city: trimmed },
						`City "${trimmed}" not found.`,
					),
				};
			}
			const { lat, lon, display_name } = results[0];
			const cityData: ManualCity = {
				name: trimmed,
				displayName: display_name.split(",")[0],
				lat: parseFloat(lat),
				lon: parseFloat(lon),
			};
			save("mb_manual_city", cityData);
			set({ manualWeatherCity: cityData });
			return { ok: true };
		} catch {
			return {
				ok: false,
				error: getErrorText(
					"geocoding_failed",
					{},
					"Failed to find the city location.",
				),
			};
		}
	},

	fetchWeather: async (latArg, lonArg, userId, force = false) => {
		if (isGuest()) return; // 샘플 날씨 유지 + 위치 권한 팝업 방지
		const manualCity = get().manualWeatherCity;

		// ── 위치 결정: 수동 도시 > Geolocation > 서울 기본값 ──
		let lat = latArg ?? 37.5665;
		let lon = lonArg ?? 126.978;
		let usingDefault = true;

		if (manualCity?.lat != null) {
			lat = manualCity.lat;
			lon = manualCity.lon;
			usingDefault = false;
		} else if (latArg == null && lonArg == null) {
			const geo = await getGeoPosition();
			if (geo) {
				lat = geo.lat;
				lon = geo.lon;
				usingDefault = false;
			}
		} else {
			usingDefault = false;
		}
		set({ usingDefaultWeatherLocation: usingDefault });

		// 좌표를 소수점 1자리로 반올림 → 동일 지역 캐시 재사용
		const rLat = Math.round(lat * 10) / 10;
		const rLon = Math.round(lon * 10) / 10;
		const lang = i18n.language?.startsWith("ko") ? "ko" : "en";
		const cacheKey = `weather_${rLat}_${rLon}_${lang}`;

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data) {
				set({ weather: dbCached.data as WeatherData, usingDefaultWeatherLocation: usingDefault });
				cacheIt("weather", dbCached.data);
				get().markFetched("weather", dbCached.fetchedAt);
				get().setApiStatus("weather", "ok");
				return;
			}
		}

		set((s) => ({
			loading: { ...s.loading, weather: true },
			errors: { ...s.errors, weather: null },
		}));
		try {
			// OpenWeatherMap Edge Function 호출 (lang 전달 → 현지화 condition/city)
			const edge = await invokeEdgeDetailed("weather", { lat: rLat, lon: rLon, lang });
			const edgeData = edge?.data as Record<string, unknown> | null;

			if (edge?.ok && edgeData && !edgeData.error) {
				const parsed = normalizeGroqWeather(edgeData);
				if (parsed) {
					set({ weather: parsed });
					cacheIt("weather", parsed);
					await writeApiCache(cacheKey, parsed, userId);
					get().markFetched("weather");
					get().setApiStatus("weather", "ok");
					return;
				}
			}

			set((s) => ({
				errors: {
					...s.errors,
					weather: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
			set({ weather: null });
			get().markFetched("weather");
			get().setApiStatus("weather", "error");
		} catch (e) {
			handleApiError(e, "fetchWeather");
			set((s) => ({
				errors: {
					...s.errors,
					weather: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
			set({ weather: null });
			get().markFetched("weather");
			get().setApiStatus("weather", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, weather: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   주식/환율 (Stocks - Twelve Data)
	   사용자 선택 심볼을 파라미터로 전달
	   ══════════════════════════════════════════ */
	fetchStocks: async (symbols = defaultStockSymbols, userId, force = false) => {
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		const normalizedSymbols = normalizeStockSymbols(symbols);
		const cacheKey = `stocks_${normalizedSymbols.join("_")}`;
		const localCachedStocks = cached<unknown[]>("stocks", []);
		const localCachedAt = Number(load("mb_cache_stocks_at", 0));
		const previousStocks = Array.isArray(get().stocks) ? get().stocks : [];

		// ✅ 캐시 우선 확인
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			if (dbCached?.data && hasMeaningfulStockValues(dbCached.data as unknown[])) {
				const pickedCachedRows = pickBestStockRowsForSymbols(
					normalizedSymbols,
					dbCached.data as unknown[],
				);
				if (hasMeaningfulStockValues(pickedCachedRows)) {
					set((s) => ({
						stocks: pickedCachedRows as StockItem[],
						errors: { ...s.errors, stocks: null },
					}));
					cacheIt("stocks", pickedCachedRows);
					get().markFetched("stocks", dbCached.fetchedAt);
					get().setApiStatus("stocks", "ok");
					return; // ← loading 상태 변경 없음
				}
			}

			const pickedLocalRows = pickBestStockRowsForSymbols(
				normalizedSymbols,
				previousStocks,
				localCachedStocks,
			);
			if (hasMeaningfulStockValues(pickedLocalRows)) {
				set((s) => ({
					stocks: pickedLocalRows as StockItem[],
					errors: { ...s.errors, stocks: null },
				}));
				get().markFetched(
					"stocks",
					localCachedAt > 0 ? localCachedAt : Date.now(),
				);
				get().setApiStatus("stocks", "ok");
				return; // ← loading 상태 변경 없음
			}
		}

		// ✅ 캐시 없으면 여기서 loading: true
		set((s) => ({
			loading: { ...s.loading, stocks: true },
			errors: { ...s.errors, stocks: null },
		}));
		try {


			const edge = await invokeEdgeDetailed("stocks", {
				symbols: normalizedSymbols,
			});

			const normalizedEdgeRows =
				edge?.ok && Array.isArray(edge.data)
					? (edge.data as unknown[]).map(normalizeStockItem).filter((r): r is StockItem => r !== null)
					: [];

			if (edge?.ok && Array.isArray(edge.data)) {
				set((s) => ({
					rawData: { ...s.rawData, stocks: edge.data },
				}));
				const merged = pickBestStockRowsForSymbols(
					normalizedSymbols,
					normalizedEdgeRows,
					previousStocks,
					localCachedStocks,
				);
				if (hasMeaningfulStockValues(merged)) {
					set({ stocks: merged as StockItem[] });
					cacheIt("stocks", merged);
					await writeApiCache(cacheKey, merged, userId);
					get().markFetched("stocks");
					get().setApiStatus("stocks", "ok");
					return;
				}
			}

			const fallbackRows = pickBestStockRowsForSymbols(
				normalizedSymbols,
				normalizedEdgeRows,
				previousStocks,
				localCachedStocks,
			);
			if (hasMeaningfulStockValues(fallbackRows)) {
				set((s) => ({
					stocks: fallbackRows as StockItem[],
					errors: { ...s.errors, stocks: null },
				}));
				cacheIt("stocks", fallbackRows);
				await writeApiCache(cacheKey, fallbackRows, userId);
				get().markFetched(
					"stocks",
					localCachedAt > 0 ? localCachedAt : Date.now(),
				);
				get().setApiStatus("stocks", "ok");
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					stocks: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
				rawData: { ...s.rawData, stocks: edge?.data ?? null },
			}));
			set({ stocks: previousStocks.length > 0 ? previousStocks : [] });
			get().markFetched("stocks");
			get().setApiStatus("stocks", "error");
		} catch (e) {
			handleApiError(e, "fetchStocks");

			const fallbackRows = pickBestStockRowsForSymbols(
				normalizedSymbols,
				previousStocks,
				localCachedStocks,
			);
			if (hasMeaningfulStockValues(fallbackRows)) {
				set((s) => ({
					stocks: fallbackRows as StockItem[],
					errors: { ...s.errors, stocks: null },
				}));
				cacheIt("stocks", fallbackRows);
				await writeApiCache(cacheKey, fallbackRows, userId);
				get().markFetched(
					"stocks",
					localCachedAt > 0 ? localCachedAt : Date.now(),
				);
				get().setApiStatus("stocks", "ok");
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					stocks: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
			set({ stocks: previousStocks.length > 0 ? previousStocks : [] });
			get().markFetched("stocks");
			get().setApiStatus("stocks", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, stocks: false } }));
		}
	},

	validateStockSymbol: async (symbol) => {
		try {
			const edge = await invokeEdgeDetailed("stocks", { symbols: [symbol] });
			if (!edge?.ok || !Array.isArray(edge.data) || edge.data.length === 0) return false;
			const row = edge.data[0] as RawStockRow | null;
			if (!row || typeof row !== "object") return false;
			return Number(row.price ?? 0) > 0;
		} catch {
			return false;
		}
	},

	/* ══════════════════════════════════════════
	   실시간 트렌드 (Tavily API)
	   trends: 해시태그 배열
	   trendsResults: 출처 배열 [{title, url, content}, ...]
	   ══════════════════════════════════════════ */
	fetchTrends: async (userId, force = false) => {
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		const lang = resolveAppLanguage();
		const isEn = lang === "en";
		// await 도중 언어가 바뀌었으면 stale 결과는 store에 쓰지 않는다 (캐시 write는 언어별 키라 허용)
		const stillCurrent = () => resolveAppLanguage() === lang;

		// 트렌드는 관심사 무관 — 세상에서 실제로 뜨는 것을 보여줌
		const cacheKey = `trends_full_${lang}`;

		// ✅ 1순위: 메모리 캐시 — 언어 전환 시 즉시 표시 (로딩 없음)
		if (!force && _trendsMemCache[lang]) {
			const mem = _trendsMemCache[lang];
			set({
				trends: mem.trends,
				trendsResults: mem.trendsResults,
				fetchedLanguage: { ...get().fetchedLanguage, trends: lang },
			});
			get().setApiStatus("trends", "ok");
			return;
		}

		// ✅ 2순위: DB 캐시 확인 (cacheKey에 언어가 포함되어 있으므로 언어별로 독립 캐시됨)
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			const dbData = dbCached?.data as Record<string, unknown> | null;
			const localizedResults = filterLocalizedArticles(
				(dbData?.results ?? []) as unknown[],
				lang,
				7,
			);
			const fallbackResults = normalizeArticleList((dbData?.results ?? []) as unknown[], 7);
			// 문제 1 fix: 캐시 read 시 언어 검증.
			// lang=ko인데 캐시 데이터에 한국어 결과가 하나도 없으면(낡은 영어 캐시)
			// 캐시 무시하고 fresh fetch로 진행 — 영어 데이터를 한글로 강제 번역해 보여주는
			// 어색한 결과를 방지.
			const cacheLanguageMismatch =
				lang === "ko" &&
				localizedResults.length === 0 &&
				fallbackResults.length > 0;
			if (cacheLanguageMismatch) {
				console.info(
					`[trends] ${cacheKey} cache invalidated: no Korean content in cached data`,
				);
			}
			const rawDisplayResults =
				localizedResults.length > 0 ? localizedResults : fallbackResults;
			const displayResults =
				cacheLanguageMismatch
					? []
					: lang === "ko"
						? await translateArticlesToKorean(rawDisplayResults)
						: rawDisplayResults;
			const displayTrends = await buildLocalizedTrendTitles(
				displayResults,
				cacheLanguageMismatch ? [] : (dbData?.trends ?? []) as string[],
				lang,
				8,
			);
			if (displayResults.length > 0 || displayTrends.length > 0) {
				const full = {
					trends: displayTrends,
					results: displayResults,
				};
				_trendsMemCache[lang] = {
					trends: full.trends,
					trendsResults: full.results,
				};
				if (lang === "ko" && dbCached && shouldBackfillKoreanCache(dbCached.data)) {
					await writeApiCache(cacheKey, full, userId, dbCached.fetchedAt);
				}
				if (!stillCurrent()) return;
				set({
					trends: full.trends,
					trendsResults: full.results,
					fetchedLanguage: { ...get().fetchedLanguage, trends: lang },
				});
				get().markFetched("trends", dbCached?.fetchedAt);
				get().setApiStatus("trends", "ok");
				return;
			}
		}

		// ✅ 캐시 없으면 여기서 loading: true
		set((s) => ({
			loading: { ...s.loading, trends: true },
			errors: { ...s.errors, trends: null },
		}));
		try {
			const trendsQuery = isEn
				? "English-language major trending news headlines today worldwide technology AI politics economy entertainment sports latest"
				: "반드시 한국어 기사 제목만 사용. 영어/일본어/중국어/러시아어 등 외국어 제목 제외. 오늘 대한민국 주요 이슈 인공지능 기술 정치 경제 연예 스포츠 최신 뉴스";
			const includeDomains = isEn ? EN_NEWS_DOMAINS : KO_NEWS_DOMAINS;

			const edge = await invokeEdgeDetailed("tavily", {
				query: trendsQuery,
				include_domains: includeDomains,
			});
			const edgeData = edge?.data as Record<string, unknown> | null;

			if (edge?.ok && edgeData?.trends) {
				const localizedResults = filterLocalizedArticles(
					(edgeData.results ?? []) as unknown[],
					lang,
					7,
				);
				const fallbackResults = normalizeArticleList((edgeData.results ?? []) as unknown[], 7);
				const candidates = localizedResults.length > 0 ? localizedResults : fallbackResults;
				// 뉴스 위젯과 같은 기사는 제외 (남는 게 3건 미만이면 그대로 사용)
				const newsUrls = new Set((get().newsResults ?? []).map((a) => (a as ArticleItem).url).filter(Boolean));
				const unique = candidates.filter((a) => !newsUrls.has((a as ArticleItem).url));
				const rawDisplayResults = unique.length >= 3 ? unique : candidates;
				const displayResults =
					lang === "ko"
						? await translateArticlesToKorean(rawDisplayResults)
						: rawDisplayResults;
				const displayTrends = await buildLocalizedTrendTitles(
					displayResults,
					(edgeData.trends ?? []) as string[],
					lang,
					8,
				);
				const full = {
					trends: displayTrends,
					results: displayResults,
				};
				_trendsMemCache[lang] = {
					trends: full.trends,
					trendsResults: full.results,
				};
				await writeApiCache(cacheKey, full, userId);
				if (!stillCurrent()) return;
				set({
					trends: full.trends,
					trendsResults: full.results,
				});
				get().markFetched("trends");
				get().setApiStatus("trends", "ok");
				set((s) => ({ fetchedLanguage: { ...s.fetchedLanguage, trends: lang } }));
				return;
			}

			if (!stillCurrent()) return;
			set((s) => ({
				errors: {
					...s.errors,
					trends: getTavilyErrorMessage(edge?.error || edgeData?.error || ""),
				},
			}));
			set({ trendsResults: [], trends: [] });
			get().markFetched("trends");
			get().setApiStatus("trends", "error");
		} catch (e) {
			handleApiError(e, "fetchTrends");
			if (!stillCurrent()) return;
			set((s) => ({
				errors: {
					...s.errors,
					trends: getTavilyErrorMessage((e as Error)?.message || ""),
				},
			}));
			set({ trendsResults: [], trends: [] });
			get().markFetched("trends");
			get().setApiStatus("trends", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, trends: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   뉴스 (Tavily API - 별도 호출)
	   newsAnswer: AI 요약 문자열
	   newsResults: 뉴스 기사 배열 [{title, url, content}, ...]
	   ══════════════════════════════════════════ */
	fetchNews: async (userId, force = false) => {
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		const lang = resolveAppLanguage();
		const isEn = lang === "en";
		// await 도중 언어가 바뀌었으면 stale 결과는 store에 쓰지 않는다 (캐시 write는 언어별 키라 허용)
		const stillCurrent = () => resolveAppLanguage() === lang;

		// 관심사 키워드 (상위 5개)
		const settingsState = useSettingsStore.getState();
		const topKeywords = getTopInterestKeywords(
			settingsState.fixedInterestIds,
			settingsState.keywordInterests,
			5,
		);
		const interestFingerprint =
			getInterestFingerprint(
				settingsState.fixedInterestIds,
				settingsState.keywordInterests,
				5,
			);

		const cacheKey = `news_${lang}_${interestFingerprint}`;

		// ✅ 캐시 우선 확인 (cacheKey에 언어가 포함되어 있으므로 언어별로 독립 캐시됨)
		if (!force) {
			const dbCached = await readApiCache(cacheKey, userId, false);
			const dbData = dbCached?.data as Record<string, unknown> | null;
			const rawDisplayResults = filterLocalizedArticles(
				(dbData?.results ?? []) as unknown[],
				lang,
				10,
			);
			const displayResults =
				lang === "ko"
					? await translateArticlesToKorean(rawDisplayResults)
					: rawDisplayResults;
			if (displayResults.length > 0) {
				const full = {
					answer: (dbData?.answer ?? null) as string | null,
					results: displayResults,
				};
				if (lang === "ko" && dbCached && shouldBackfillKoreanCache(dbCached.data)) {
					await writeApiCache(cacheKey, full, userId, dbCached.fetchedAt);
				}
				if (!stillCurrent()) return;
				set({
					newsAnswer: full.answer,
					newsResults: full.results,
					fetchedLanguage: { ...get().fetchedLanguage, news: lang },
				});
				get().markFetched("news", dbCached?.fetchedAt);
				get().setApiStatus("news", "ok");
				return;
			}
		}

		// ✅ 캐시 없으면 여기서 loading: true
		set((s) => ({
			loading: { ...s.loading, news: true },
			errors: { ...s.errors, news: null },
		}));
		try {
			// 로컬 뉴스 5개 + 글로벌 뉴스 5개 병렬 호출 (geolocation 제거 — 언어별 쿼리로 대체)
			const interestClause = topKeywords.length > 0
				? (isEn ? ` Focus topics: ${topKeywords.join(", ")}.` : ` 관심 주제: ${topKeywords.join(", ")}.`)
				: "";
			const localQuery = isEn
				? `Top 10 live issues in America: politics, tech, economy, lifestyle trends today.${interestClause}`
				: `대한민국 실시간 주요 뉴스: 정치, 경제, IT, 라이프스타일, 사회 트렌드 오늘.${interestClause}`;

			const includeDomains = isEn ? EN_NEWS_DOMAINS : KO_NEWS_DOMAINS;
			const globalNewsQuery = isEn
				? "Top world breaking news today: international politics, business, technology, science."
				: "오늘의 세계 주요 뉴스 속보: 국제 정치, 경제, 기술, 과학.";

			// 국내 + 세계 뉴스를 Edge Function 배치 1회로 (서버에서 병렬 검색, 쿼리별 실패는 { error }로 옴)
			const edge = await invokeEdgeDetailed("tavily", {
				queries: [
					{
						query: localQuery,
						mode: "news",
						max_results: 12,
						...(includeDomains.length > 0 ? { include_domains: includeDomains } : {}),
					},
					{ query: globalNewsQuery, mode: "news", max_results: 5 },
				],
			});
			const batch = (edge?.ok ? (edge.data as { batch?: Record<string, unknown>[] } | null)?.batch : null) ?? [];
			const toResult = (d: Record<string, unknown> | undefined) => ({
				ok: Boolean(d && !d.error),
				error: d ? null : (edge?.error ?? null),
			});
			const [localEdgeData = null, globalEdgeData = null] = batch;
			const localEdge = toResult(batch[0]);
			const globalEdge = toResult(batch[1]);

			const localRawResults = localEdge?.ok ? ((localEdgeData?.results ?? []) as unknown[]) : [];
			const localResults = filterLocalizedArticles(localRawResults, lang, 5);
			const localExtendedResults = filterLocalizedArticles(localRawResults, lang, 12);
			const globalResults = globalEdge?.ok
				? filterLocalizedArticles((globalEdgeData?.results ?? []) as unknown[], lang, 5)
				: [];
			const didFetchAny = Boolean(localEdge?.ok || globalEdge?.ok);

			if (localResults.length > 0 || globalResults.length > 0) {
				const merged = dedupeArticles([
					...localResults,
					...globalResults,
				]).slice(0, 10);
				const finalResults =
					lang === "ko"
						? await translateArticlesToKorean(merged)
						: merged;
				const full = {
					answer: (localEdgeData?.answer ?? globalEdgeData?.answer ?? null) as string | null,
					results: finalResults,
				};
				await writeApiCache(cacheKey, full, userId);
				if (!stillCurrent()) return;
				set({
					newsAnswer: full.answer,
					newsResults: full.results,
				});
				get().markFetched("news");
				get().setApiStatus("news", "ok");
				set((s) => ({ fetchedLanguage: { ...s.fetchedLanguage, news: lang } }));

				// trends 상태가 비어 있으면 local 확장 결과(12건)에서 파생 — 별도 Tavily 호출 절약
				// 뉴스와 중복되는 URL은 제외하여 브리핑에서 두 섹션이 동일해지지 않도록 함
				if ((get().trends ?? []).length === 0 && localExtendedResults.length > 0) {
					try {
						const newsUrls = new Set(
							(get().newsResults ?? []).map((a) => (a as ArticleItem).url).filter(Boolean),
						);
						const uniqueExtended = localExtendedResults.filter(
							(a) => !newsUrls.has((a as ArticleItem).url),
						);
						const sourceForTrends = uniqueExtended.length >= 3 ? uniqueExtended : localExtendedResults;
						const translatedExtended =
							lang === "ko"
								? await translateArticlesToKorean(sourceForTrends)
								: sourceForTrends;
						const derivedTrends = await buildLocalizedTrendTitles(
							translatedExtended,
							[],
							lang,
							8,
						);
						if (derivedTrends.length > 0) {
							const trendsResults = translatedExtended.slice(0, 7);
							const trendsCacheKey = `trends_full_${lang}`;
							_trendsMemCache[lang] = { trends: derivedTrends, trendsResults };
							await writeApiCache(
								trendsCacheKey,
								{ trends: derivedTrends, results: trendsResults },
								userId,
							);
							if (!stillCurrent()) return;
							set({ trends: derivedTrends, trendsResults });
							get().markFetched("trends");
							get().setApiStatus("trends", "ok");
							set((s) => ({
								fetchedLanguage: { ...s.fetchedLanguage, trends: lang },
							}));
						}
					} catch (e) {
						handleApiError(e, "fetchNews:trends");
					}
				}

				return;
			}

			if (didFetchAny) {
				const full = {
					answer: (localEdgeData?.answer ?? globalEdgeData?.answer ?? null) as string | null,
					results: [] as ArticleItem[],
				};
				await writeApiCache(cacheKey, full, userId);
				if (!stillCurrent()) return;
				set({
					newsAnswer: full.answer,
					newsResults: full.results,
				});
				get().markFetched("news");
				get().setApiStatus("news", "ok");
				set((s) => ({ fetchedLanguage: { ...s.fetchedLanguage, news: lang } }));
				return;
			}

			if (!stillCurrent()) return;
			set((s) => ({
				errors: {
					...s.errors,
					news: getTavilyErrorMessage(
						localEdge?.error ||
						localEdgeData?.error ||
						globalEdge?.error ||
						globalEdgeData?.error ||
						"",
					),
				},
			}));
			set({ newsResults: [] });
			get().markFetched("news");
			get().setApiStatus("news", "error");
		} catch (e) {
			handleApiError(e, "fetchNews");
			if (!stillCurrent()) return;
			set((s) => ({
				errors: {
					...s.errors,
					news: getTavilyErrorMessage((e as Error)?.message || ""),
				},
			}));
			set({ newsResults: [] });
			get().markFetched("news");
			get().setApiStatus("news", "error");
		} finally {
			set((s) => ({ loading: { ...s.loading, news: false } }));
		}
	},

	/* ══════════════════════════════════════════
	   캘린더 (Google Calendar)
	   오늘 일정(Today's Schedule)만 가져오기
	   ══════════════════════════════════════════ */
	fetchCalendar: async (userId, force = false) => {
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		if (!useOnboardingStore.getState().perms.cal) {
			set({ calEvents: [] });
			get().markFetched("calendar");
			return;
		}
		if (!supabase) {
			set({ calEvents: [] });
			get().markFetched("calendar");
			return;
		}

		try {
			const cacheKey = "calendar_today";

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached?.data) {
					set({ calEvents: dbCached.data as CalendarEventBasic[] });
					cacheIt("calendar", dbCached.data);
					get().markFetched("calendar", dbCached.fetchedAt);
					return;
				}
			}

			const token = await useAuthStore.getState().ensureProviderToken?.();
			if (!token) {
				set({ calEvents: [] });
				get().markFetched("calendar");
				return;
			}

			const todayStr = formatLocalDate();
			const startLocalToday = new Date(`${todayStr}T00:00:00`);
			const endLocalToday = new Date(startLocalToday.getTime() + 24 * 60 * 60 * 1000);
			const data = await invokeEdge("events", {
				token,
				timeMin: startLocalToday.toISOString(),
				timeMax: endLocalToday.toISOString(),
			});
			if (data && Array.isArray(data)) {
				// 프론트에서도 오늘 일정만 필터링 (안전장치)
				const todayEvents = (data as CalendarEventBasic[]).filter((ev) => {
					const start = ev.start;
					if (!start) return false;
					return String(start).startsWith(todayStr);
				});
				set({ calEvents: todayEvents });
				cacheIt("calendar", todayEvents);
				await writeApiCache(cacheKey, todayEvents, userId);
				get().markFetched("calendar");
			} else {
				set({ calEvents: cached<CalendarEventBasic[]>("calendar", []) });
				get().markFetched("calendar");
			}
		} catch (e) {
			handleApiError(e, "fetchCalendar");
			set({ calEvents: cached<CalendarEventBasic[]>("calendar", []) });
			get().markFetched("calendar");
		}
	},

	/* ══════════════════════════════════════════
	   캘린더 - 내일 일정 (Tomorrow)
	   오후 브리핑에서 사용
	   ══════════════════════════════════════════ */
	fetchTomorrowCalendar: async (userId, force = false) => {
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		if (!useOnboardingStore.getState().perms.cal) {
			set({ tomorrowEvents: [] });
			return;
		}
		if (!supabase) {
			set({ tomorrowEvents: [] });
			return;
		}

		const tomorrowStr = shiftDateString(formatLocalDate(), 1);
		const cacheKey = `calendar_${tomorrowStr}`;

		try {
			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached?.data) {
					set({ tomorrowEvents: dbCached.data as CalendarEventBasic[] });
					return;
				}
			}

			const token = await useAuthStore.getState().ensureProviderToken?.();
			if (!token) {
				set({ tomorrowEvents: [] });
				return;
			}

			const startLocal = new Date(`${tomorrowStr}T00:00:00`);
			const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
			const data = await invokeEdge("events", {
				token,
				timeMin: startLocal.toISOString(),
				timeMax: endLocal.toISOString(),
			});
			if (data && Array.isArray(data)) {
				const filtered = (data as CalendarEventBasic[]).filter((ev) =>
					String(ev?.start ?? "").startsWith(tomorrowStr),
				);
				set({ tomorrowEvents: filtered });
				await writeApiCache(cacheKey, filtered, userId);
			} else {
				set({ tomorrowEvents: [] });
			}
		} catch (e) {
			handleApiError(e, "fetchTomorrowCalendar");
			set({ tomorrowEvents: [] });
		}
	},

	/* ══════════════════════════════════════════
	   건강 (Google Fitness)
	   Steps + Sleep 중심, 나머지는 보조 데이터
	   ══════════════════════════════════════════ */
	fetchHealth: async (userId, force = false) => {
		if (isGuest()) return; // 새로고침 버튼이 샘플 데이터를 지우지 않게
		if (!useOnboardingStore.getState().perms.fit) {
			set({ healthData: null });
			get().markFetched("health");
			get().setApiStatus("health", null);
			return;
		}
		if (!supabase) {
			set((s) => ({
				errors: {
					...s.errors,
					health: getErrorText(
						"connection_failed",
						{},
						"Connection failed. Please try again later.",
					),
				},
			}));
			set({ healthData: null });
			get().setApiStatus("health", "error");
			return;
		}

		set((s) => ({
			loading: { ...s.loading, health: true },
			errors: { ...s.errors, health: null },
		}));

		try {
			const cacheKey = "health_default";

			if (!force) {
				const dbCached = await readApiCache(cacheKey, userId, false);
				if (dbCached?.data) {
					set({ healthData: dbCached.data as HealthData });
					cacheIt("health", dbCached.data);
					get().markFetched("health", dbCached.fetchedAt);
					get().setApiStatus("health", "ok");
					return;
				}
			}

			const token = await useAuthStore.getState().ensureProviderToken?.();
			if (!token) {
				set((s) => ({
					errors: {
						...s.errors,
						health: getGoogleHealthErrorMessage("unauthorized"),
					},
				}));
				set({ healthData: null });
				get().setApiStatus("health", "error");
				return;
			}

			// 오늘 0시는 사용자 로컬 기준 — 서버(UTC)에서 계산하면 KST 09시 이전 기록이 빠짐 (BACKLOG R13)
			const startOfLocalDay = new Date();
			startOfLocalDay.setHours(0, 0, 0, 0);
			const edge = await invokeEdgeDetailed("fitness", { token, startTimeMillis: startOfLocalDay.getTime() });
			if (edge?.ok && edge.data) {
				const normalized = normalizeHealthData(edge.data);
				set({ healthData: normalized });
				cacheIt("health", normalized);
				await writeApiCache(cacheKey, normalized, userId);
				get().markFetched("health");
				get().setApiStatus("health", "ok");
			} else {
				const edgeData = edge?.data as Record<string, unknown> | null;
				set((s) => ({
					errors: {
						...s.errors,
						health: getGoogleHealthErrorMessage(
							String(edge?.error || edgeData?.error || ""),
						),
					},
				}));
				set({ healthData: null });
				get().markFetched("health");
				get().setApiStatus("health", "error");
			}
		} catch (e) {
			handleApiError(e, "fetchHealth");
			set((s) => ({
				errors: {
					...s.errors,
					health: getGoogleHealthErrorMessage((e as Error)?.message || ""),
				},
			}));
			set({ healthData: null });
			get().markFetched("health");
			get().setApiStatus("health", "error");
		} finally {
			set((s) => ({
				loading: { ...s.loading, health: false },
			}));
		}
	},

	/* ══════════════════════════════════════════
	   전체 fetch (캐시 우선 최적화)

	   옵션:
	   - useExistingCache: true → 캐시 있으면 API 호출 생략 (로그인 직후)
	   - useExistingCache: false (기본값) → 기존 동작 (1시간 stale 체크)

	   1) useExistingCache=true → force=false로 모든 fetch 호출 (캐시 우선)
	   2) useExistingCache=false → isCacheStale() 결과에 따라 force 결정
	   3) 위젯별 수동 새로고침 → 개별 fetch 함수에서 force=true로 직접 호출
	   ══════════════════════════════════════════ */
	fetchAll: async (options = {}) => {
		if (isGuest()) return; // 게스트는 샘플 데이터만 사용
		const { useExistingCache = false } = options;
		const store = get();

		// useExistingCache=true면 항상 캐시 우선 (force=false)
		// useExistingCache=false면 기존 30분 stale 체크 적용
		const shouldForceRefresh = useExistingCache ? false : isCacheStale();

		let userId: string | null = null;
		let visibleWidgets = Object.keys(DEFAULT_VIS).filter(
			(key) => (DEFAULT_VIS as Record<string, boolean>)[key],
		);

		if (supabase) {
			try {
				userId = getUserId();
				if (userId) {
					const [settingsRes, layoutRes] = await Promise.all([
						supabase.from("user_settings").select("*").eq("id", userId).single(),
						supabase
							.from("widget_layouts")
							.select("layouts")
							.eq("id", userId)
							.single(),
					]);

					const settings = settingsRes.data as Record<string, unknown> | null;
					const layouts = (layoutRes.data as { layouts?: unknown } | null)?.layouts ?? null;

					set({
						onboardingProfile: {
							age: null,
							interests: [],
							persona: (settings?.persona ?? null) as string | null,
						},
					});

					const visibility: Record<string, boolean> = {
						...(DEFAULT_VIS as Record<string, boolean>),
						...((settings?.vis as Record<string, boolean>) ?? {}),
					};

					// Use visibility as the authoritative source.
					// layouts only determine grid positions — they should not gate fetching.
					// Smart widgets from layouts are additive.
					const layoutIds = extractLayoutWidgetIds(layouts);
					const smartFromLayouts = [...layoutIds].filter((id) =>
						id.startsWith("smart_"),
					);
					visibleWidgets = [
						...Object.keys(visibility).filter((id) => visibility[id] === true),
						...smartFromLayouts,
					];
				}
			} catch (dbErr) {
				handleApiError(dbErr, "fetchAll:db");
			}
		}

		set({ activeWidgetIds: visibleWidgets });

		// 문제 5 fix: 양 언어 trends 캐시를 메모리에 미리 적재 (DB read만, API 호출 없음).
		// fetchTrends와 병렬로 진행 — fetchTrends가 끝나기 전이라도 다른 언어는 이미 준비됨.
		if (userId && visibleWidgets.includes("trends")) {
			warmupTrendsMemCache(userId).catch(() => {});
		}

		const stockSymbols =
			useSettingsStore?.getState?.()?.stockSymbols ?? defaultStockSymbols;
		const fixedIndexSymbols =
			useSettingsStore?.getState?.()?.fixedIndexSymbols ?? [];
		const allStockSymbols = [
			...new Set([...fixedIndexSymbols, ...stockSymbols]),
		];

		const jobs: Promise<unknown>[] = [];
		if (visibleWidgets.includes("weather"))
			jobs.push(
				store
					.fetchWeather(undefined, undefined, userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:weather"),
					),
			);
		if (visibleWidgets.includes("stocks"))
			jobs.push(
				store
					.fetchStocks(allStockSymbols, userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:stocks"),
					),
			);
		// news → trends 순서로 실행: fetchNews가 trends를 파생하면 Tavily 호출 1회 절약
		if (visibleWidgets.includes("trends") && visibleWidgets.includes("news")) {
			jobs.push(
				store
					.fetchNews(userId, shouldForceRefresh)
					.then(() => store.fetchTrends(userId, shouldForceRefresh))
					.catch((e) =>
						handleApiError(e, "fetchAll:news+trends"),
					),
			);
		} else {
			if (visibleWidgets.includes("trends"))
				jobs.push(
					store
						.fetchTrends(userId, shouldForceRefresh)
						.catch((e) =>
							handleApiError(e, "fetchAll:trends"),
						),
				);
			if (visibleWidgets.includes("news"))
				jobs.push(
					store
						.fetchNews(userId, shouldForceRefresh)
						.catch((e) =>
							handleApiError(e, "fetchAll:news"),
						),
				);
		}
		if (visibleWidgets.includes("calendar")) {
			jobs.push(
				store
					.fetchCalendar(userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:calendar"),
					),
			);
		}
		// 브리핑은 FIXED_WIDGET이므로 calendar 위젯 표시 여부와 무관하게 항상 fetch
		jobs.push(
			store
				.fetchTomorrowCalendar(userId, shouldForceRefresh)
				.catch((e) =>
					handleApiError(e, "fetchAll:tomorrow"),
				),
		);
		if (visibleWidgets.includes("health"))
			jobs.push(
				store
					.fetchHealth(userId, shouldForceRefresh)
					.catch((e) =>
						handleApiError(e, "fetchAll:health"),
					),
			);

		await Promise.all(jobs);
		set({ initialFetchDone: true });

		// fetchAll 완료 후 접속 시간 갱신
		setLastAccessTime();
	},
}));

// 언어 변경 시 뉴스/트렌드 즉시 초기화 후 새 언어로 강제 재호출
i18n.on("languageChanged", () => {
	const store = useDataStore.getState();
	const userId = useAuthStore.getState().user?.id;
	const hasNews = store.apiStatus?.news === "ok" || store.apiStatus?.news === "error";
	const hasTrends = store.apiStatus?.trends === "ok" || store.apiStatus?.trends === "error";
	if (hasNews || hasTrends) {
		store.clearFeedForLanguageSwitch();
	}
	// news 먼저 완료 후 trends 실행 — fetchNews가 trends를 파생하면 Tavily 1회 절약
	if (hasNews) {
		store.fetchNews(userId, false).then(() => {
			if (hasTrends) store.fetchTrends(userId, false);
		});
	} else if (hasTrends) {
		store.fetchTrends(userId, false);
	}
});

// fetchAll 동시 실행 방지: 초기화·5분 폴링·탭 복귀가 겹치면 진행 중인 작업을 재사용
// (캐시가 비었을 때 같은 Tavily/Groq 요청이 중복으로 나가던 문제)
const runFetchAll = useDataStore.getState().fetchAll;
let fetchAllInFlight: Promise<void> | null = null;
useDataStore.setState({
	fetchAll: (options) =>
		(fetchAllInFlight ??= runFetchAll(options).finally(() => {
			fetchAllInFlight = null;
		})),
});

// 관심사 변경 시 뉴스 자동 재호출 — 상위 키워드 "구성"이 바뀔 때만.
// 순서만 바뀌는 경우(개인화 배치 점수 갱신 등)는 결과가 같으므로 정렬해서 비교
const getInterestFingerprintFromState = (settingsState: ReturnType<typeof useSettingsStore.getState>): string =>
	getInterestFingerprint(
		settingsState?.fixedInterestIds,
		settingsState?.keywordInterests,
		5,
	).split("+").sort().join("+");

let _prevInterestFingerprint = getInterestFingerprintFromState(
	useSettingsStore.getState(),
);

useSettingsStore.subscribe((state) => {
	const fingerprint = getInterestFingerprintFromState(state);
	if (fingerprint === _prevInterestFingerprint) return;
	_prevInterestFingerprint = fingerprint;

	// 뉴스만 재호출 — 트렌드는 관심사와 무관하게 세계 트렌드를 반영
	const store = useDataStore.getState();
	const userId = useAuthStore.getState().user?.id;
	if (store.apiStatus?.news === "ok" || store.apiStatus?.news === "error") {
		// force=false: 새 관심사 기준 캐시(6h)가 있으면 재사용 — 없을 때만 Tavily 호출
		store.fetchNews(userId, false);
	}
});
