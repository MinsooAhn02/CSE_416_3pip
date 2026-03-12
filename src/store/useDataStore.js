import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { load, save } from "../utils/storage";
import { DEFAULT_VIS } from "../constants";
import {
	fetchWeather,
	fetchStocks,
	fetchTrends,
	fetchRestaurants,
	fetchCalendarEvents,
	fetchHealthData,
} from "../mock/data";

const DEBUG_FLOW = import.meta.env.VITE_DEBUG_FLOW === "1";
const EDGE_TIMEOUT_MS = 5000;

/* ── Edge Function 호출 헬퍼 ── */
const invokeEdgeDetailed = async (fnName, body = {}) => {
	if (!supabase) return null;
	const startedAt = Date.now();
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => resolve({ __timeout: true }), EDGE_TIMEOUT_MS);
	});
	try {
		const result = await Promise.race([
			supabase.functions.invoke(fnName, { body }),
			timeoutPromise,
		]);

		if (result?.__timeout) {
			console.warn(`[edge] ${fnName} timed out after ${EDGE_TIMEOUT_MS}ms`);
			return {
				ok: false,
				data: null,
				error: `timeout ${EDGE_TIMEOUT_MS}ms`,
				timedOut: true,
				elapsedMs: Date.now() - startedAt,
			};
		}

		const { data, error } = result;
		if (error) {
			return {
				ok: false,
				data,
				error: error.message || "Edge invoke failed",
				timedOut: false,
				elapsedMs: Date.now() - startedAt,
			};
		}
		if (DEBUG_FLOW) {
			console.log(`[edge] ${fnName} ok in ${Date.now() - startedAt}ms`);
		}
		return {
			ok: true,
			data,
			error: null,
			timedOut: false,
			elapsedMs: Date.now() - startedAt,
		};
	} catch (e) {
		console.warn(`Edge Function [${fnName}] failed:`, e.message);
		if (DEBUG_FLOW) {
			console.warn(`[edge] ${fnName} failed in ${Date.now() - startedAt}ms`);
		}
		return {
			ok: false,
			data: null,
			error: e.message || "Edge invoke failed",
			timedOut: false,
			elapsedMs: Date.now() - startedAt,
		};
	}
};

const invokeEdge = async (fnName, body = {}) => {
	const result = await invokeEdgeDetailed(fnName, body);
	return result?.ok ? result.data : null;
};

/* ── 캐시 헬퍼 (Graceful Degradation) ── */
const cached = (key, fallback) => load(`mb_cache_${key}`, fallback);
const cacheIt = (key, data) => {
	save(`mb_cache_${key}`, data);
	save(`mb_cache_${key}_at`, Date.now());
};

const CACHE_TTL_MS = {
	weather: 10 * 60 * 1000,
	stocks: 5 * 60 * 1000,
	trends: 20 * 60 * 1000,
	restaurants: 20 * 60 * 1000,
	calendar: 5 * 60 * 1000,
	health: 15 * 60 * 1000,
};

const getUserId = async () => {
	if (!supabase) return null;
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
};

const toCacheRowId = (userId, cacheKey) => `u:${userId}:${cacheKey}`;

const readApiCache = async (cacheKey, ttlMs, userIdArg) => {
	if (!supabase) return null;
	const userId = userIdArg ?? (await getUserId());
	if (!userId) return null;

	const rowId = toCacheRowId(userId, cacheKey);
	const { data, error } = await supabase
		.from("api_cache")
		.select("data, fetched_at")
		.eq("id", rowId)
		.single();

	if (error) {
		if (error.code !== "PGRST116") {
			console.warn(`api_cache read failed [${cacheKey}]:`, error.message);
		}
		return null;
	}

	if (!data?.fetched_at) return null;
	const age = Date.now() - new Date(data.fetched_at).getTime();
	if (!Number.isFinite(age) || age > ttlMs) return null;

	return data.data ?? null;
};

const writeApiCache = async (cacheKey, payload, userIdArg) => {
	if (!supabase) return;
	const userId = userIdArg ?? (await getUserId());
	if (!userId) return;

	const rowId = toCacheRowId(userId, cacheKey);
	const { error } = await supabase.from("api_cache").upsert({
		id: rowId,
		user_id: userId,
		data: payload,
		fetched_at: new Date().toISOString(),
	});

	if (error) {
		console.warn(`api_cache write failed [${cacheKey}]:`, error.message);
	}
};

const extractLayoutWidgetIds = (layouts) => {
	if (!layouts || typeof layouts !== "object") return new Set();
	const ids = new Set();
	for (const key of Object.keys(layouts)) {
		const bpLayout = layouts[key];
		if (!Array.isArray(bpLayout)) continue;
		for (const item of bpLayout) {
			if (item?.i) ids.add(item.i);
		}
	}
	return ids;
};

const numberFormatter = new Intl.NumberFormat("ko-KR", {
	maximumFractionDigits: 2,
});

const extractJsonObject = (text) => {
	if (!text || typeof text !== "string") return null;
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const match = trimmed.match(/\{[\s\S]*\}/);
		if (!match) return null;
		try {
			return JSON.parse(match[0]);
		} catch {
			return null;
		}
	}
};

const normalizeGroqWeather = (payload) => {
	if (!payload || typeof payload !== "object") return null;
	const temp = Number(payload.temp);
	const humidity = Number(payload.humidity);
	const precipitation = Number(payload.precipitation);
	return {
		temp: Number.isFinite(temp) ? temp : 20,
		city: String(payload.city || "서울"),
		condition: String(payload.condition || payload.description || "정보 없음"),
		precipitation: Number.isFinite(precipitation) ? precipitation : 0,
		airQuality: String(payload.airQuality || "정보 없음"),
		humidity: Number.isFinite(humidity) ? humidity : 50,
	};
};

const normalizeStockItem = (item) => {
	if (!item) return null;
	if ("name" in item && "value" in item) return item;

	const numericChange = Number(item.change ?? 0);
	const numericPrice = Number(item.price ?? 0);

	return {
		name: item.symbol === "SP500" ? "S&P 500" : item.symbol,
		value: numberFormatter.format(numericPrice),
		change:
			typeof item.changePercent === "string"
				? item.changePercent.replace(/^\+/, "")
				: `${numericChange >= 0 ? "+" : ""}${numberFormatter.format(numericChange)}`,
		up: numericChange >= 0,
	};
};

const hasMeaningfulStockValues = (rows) => {
	if (!Array.isArray(rows) || rows.length === 0) return false;
	return rows.some((row) => Number(row?.price ?? 0) > 0);
};

const normalizeRestaurantItem = (item) => {
	if (!item) return null;
	if ("price" in item || "rating" in item) return item;

	return {
		name: item.name,
		category: item.category?.split(" > ").pop() ?? "맛집",
		distance: item.distance ? `${item.distance}m` : "거리 정보 없음",
		address: item.address,
		url: item.url,
	};
};

export const useDataStore = create((set, get) => ({
	weather: null,
	stocks: [],
	trends: [],
	restaurants: [],
	calEvents: [],
	healthData: null,
	rawData: {
		weather: null,
		stocks: null,
		trends: null,
	},
	onboardingProfile: null,
	activeWidgetIds: [],
	loading: {},
	errors: {},
	setActiveWidgetIds: (ids) => set({ activeWidgetIds: ids }),

	/* ── 개별 fetch (Edge Function 또는 mock fallback) ── */
	fetchWeather: async (lat = 37.5665, lon = 126.978, userId) => {
		set((s) => ({ loading: { ...s.loading, weather: true } }));
		set((s) => ({ errors: { ...s.errors, weather: null } }));
		try {
			const cacheKey = `weather_${lat}_${lon}`;
			const dbCached = await readApiCache(
				cacheKey,
				CACHE_TTL_MS.weather,
				userId,
			);
			if (dbCached) {
				set({ weather: dbCached });
				cacheIt("weather", dbCached);
				return;
			}

			const edge = await invokeEdgeDetailed("groq", {
				system:
					"너는 날씨 정보 생성기다. 반드시 JSON 객체만 반환하고 다른 텍스트를 포함하지 마라.",
				prompt: [
					"아래 좌표 기준으로 현실적인 현재 날씨 추정 JSON을 만들어라.",
					`lat=${lat}, lon=${lon}`,
					"반드시 다음 키만 포함: temp, city, condition, precipitation, airQuality, humidity",
					"제약: temp/humidity/precipitation은 숫자, city/condition/airQuality는 문자열",
					'예시 형식: {"temp":18,"city":"서울","condition":"맑음","precipitation":10,"airQuality":"보통","humidity":45}',
				].join("\n"),
				temperature: 0.2,
			});
			const parsed = normalizeGroqWeather(extractJsonObject(edge?.data?.text));
			if (edge?.ok && parsed) {
				set((s) => ({
					rawData: {
						...s.rawData,
						weather: {
							source: "groq",
							text: edge.data?.text ?? null,
							parsed,
						},
					},
				}));
				set({ weather: parsed });
				cacheIt("weather", parsed);
				await writeApiCache(cacheKey, parsed, userId);
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					weather: edge?.error || "Groq 날씨 응답 파싱에 실패했습니다.",
				},
				rawData: {
					...s.rawData,
					weather: {
						source: "groq",
						text: edge?.data?.text ?? null,
						parsed: null,
					},
				},
			}));

			const mock = await fetchWeather(lat, lon);
			set({ weather: cached("weather", mock) });
		} catch (e) {
			console.warn("fetchWeather failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					weather: e?.message || "날씨 데이터를 불러오지 못했습니다.",
				},
			}));
			const mock = await fetchWeather(lat, lon);
			set({ weather: cached("weather", mock) });
		} finally {
			set((s) => ({ loading: { ...s.loading, weather: false } }));
		}
	},

	fetchStocks: async (userId) => {
		set((s) => ({ loading: { ...s.loading, stocks: true } }));
		set((s) => ({ errors: { ...s.errors, stocks: null } }));
		try {
			const cacheKey = "stocks_default";
			const dbCached = await readApiCache(
				cacheKey,
				CACHE_TTL_MS.stocks,
				userId,
			);
			if (dbCached && hasMeaningfulStockValues(dbCached)) {
				set({ stocks: dbCached });
				cacheIt("stocks", dbCached);
				return;
			}

			const edge = await invokeEdgeDetailed("stocks", {
				symbols: ["KOSPI", "NASDAQ", "SP500", "USDKRW"],
			});
			if (
				edge?.ok &&
				Array.isArray(edge.data) &&
				hasMeaningfulStockValues(edge.data)
			) {
				set((s) => ({
					rawData: { ...s.rawData, stocks: edge.data },
				}));
				const normalized = edge.data.map(normalizeStockItem).filter(Boolean);
				set({ stocks: normalized });
				cacheIt("stocks", normalized);
				await writeApiCache(cacheKey, normalized, userId);
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					stocks:
						edge?.error ||
						"주식 API가 유효하지 않은 값(전부 0)을 반환했습니다.",
				},
				rawData: { ...s.rawData, stocks: edge?.data ?? null },
			}));

			const mock = await fetchStocks();
			set({ stocks: cached("stocks", mock) });
		} catch (e) {
			console.warn("fetchStocks failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					stocks: e?.message || "주식 데이터를 불러오지 못했습니다.",
				},
			}));
			const mock = await fetchStocks();
			set({ stocks: cached("stocks", mock) });
		} finally {
			set((s) => ({ loading: { ...s.loading, stocks: false } }));
		}
	},

	fetchTrends: async (userId) => {
		set((s) => ({ loading: { ...s.loading, trends: true } }));
		set((s) => ({ errors: { ...s.errors, trends: null } }));
		try {
			const cacheKey = "trends_default";
			const dbCached = await readApiCache(
				cacheKey,
				CACHE_TTL_MS.trends,
				userId,
			);
			if (dbCached) {
				set({ trends: dbCached });
				cacheIt("trends", dbCached);
				return;
			}

			const edge = await invokeEdgeDetailed("tavily", {
				query:
					"대한민국 실시간 이슈, 기술, 경제, 캠퍼스, 라이프스타일 관련 최신 트렌드 7개",
			});
			if (edge?.data) {
				set((s) => ({ rawData: { ...s.rawData, trends: edge.data } }));
			}
			if (edge?.ok && edge.data?.trends) {
				set({ trends: edge.data.trends });
				cacheIt("trends", edge.data.trends);
				await writeApiCache(cacheKey, edge.data.trends, userId);
				return;
			}

			set((s) => ({
				errors: {
					...s.errors,
					trends: edge?.error || "트렌드 API 응답이 비어 있습니다.",
				},
			}));

			const mock = await fetchTrends();
			set({ trends: cached("trends", mock) });
		} catch (e) {
			console.warn("fetchTrends failed:", e?.message || e);
			set((s) => ({
				errors: {
					...s.errors,
					trends: e?.message || "트렌드를 불러오지 못했습니다.",
				},
			}));
			const mock = await fetchTrends();
			set({ trends: cached("trends", mock) });
		} finally {
			set((s) => ({ loading: { ...s.loading, trends: false } }));
		}
	},

	fetchRestaurants: async (
		query = "맛집",
		lat = 37.5665,
		lon = 126.978,
		userId,
	) => {
		set((s) => ({ loading: { ...s.loading, restaurants: true } }));
		try {
			const cacheKey = `restaurants_${query}_${lat}_${lon}`;
			const dbCached = await readApiCache(
				cacheKey,
				CACHE_TTL_MS.restaurants,
				userId,
			);
			if (dbCached) {
				set({ restaurants: dbCached });
				cacheIt("restaurants", dbCached);
				return;
			}

			const data = await invokeEdge("kakao-places", {
				query,
				lat,
				lon,
				radius: 1200,
			});
			if (data) {
				const normalized = data.map(normalizeRestaurantItem).filter(Boolean);
				set({ restaurants: normalized });
				cacheIt("restaurants", normalized);
				await writeApiCache(cacheKey, normalized, userId);
				return;
			}

			const mock = await fetchRestaurants();
			set({ restaurants: cached("restaurants", mock) });
		} catch (e) {
			console.warn("fetchRestaurants failed:", e?.message || e);
			const mock = await fetchRestaurants();
			set({ restaurants: cached("restaurants", mock) });
		} finally {
			set((s) => ({ loading: { ...s.loading, restaurants: false } }));
		}
	},

	fetchCalendar: async (userId) => {
		if (!supabase) {
			const mock = await fetchCalendarEvents();
			set({ calEvents: mock });
			return;
		}

		const cacheKey = "calendar_default";
		const dbCached = await readApiCache(
			cacheKey,
			CACHE_TTL_MS.calendar,
			userId,
		);
		if (dbCached) {
			set({ calEvents: dbCached });
			cacheIt("calendar", dbCached);
			return;
		}

		const {
			data: { session },
		} = await supabase.auth.getSession();
		const token = session?.provider_token;
		if (!token) {
			const mock = await fetchCalendarEvents();
			set({ calEvents: mock });
			return;
		}
		const data = await invokeEdge("calendar", { token });
		if (data) {
			set({ calEvents: data });
			cacheIt("calendar", data);
			await writeApiCache(cacheKey, data, userId);
		} else {
			const mock = await fetchCalendarEvents();
			set({ calEvents: cached("calendar", mock) });
		}
	},

	fetchHealth: async (userId) => {
		if (!supabase) {
			const mock = await fetchHealthData();
			set({ healthData: mock });
			return;
		}

		const cacheKey = "health_default";
		const dbCached = await readApiCache(cacheKey, CACHE_TTL_MS.health, userId);
		if (dbCached) {
			set({ healthData: dbCached });
			cacheIt("health", dbCached);
			return;
		}

		const {
			data: { session },
		} = await supabase.auth.getSession();
		const token = session?.provider_token;
		if (!token) {
			const mock = await fetchHealthData();
			set({ healthData: mock });
			return;
		}
		const data = await invokeEdge("fitness", { token });
		if (data) {
			set({ healthData: data });
			cacheIt("health", data);
			await writeApiCache(cacheKey, data, userId);
		} else {
			const mock = await fetchHealthData();
			set({ healthData: cached("health", mock) });
		}
	},

	/* ── 전체 fetch (기존 인터페이스 유지) ── */
	fetchAll: async () => {
		const store = get();

		let userId = null;
		let visibleWidgets = Object.keys(DEFAULT_VIS).filter(
			(key) => DEFAULT_VIS[key],
		);

		if (supabase) {
			userId = await getUserId();
			if (userId) {
				const [settingsRes, layoutRes] = await Promise.all([
					supabase.from("user_settings").select("*").eq("id", userId).single(),
					supabase
						.from("widget_layouts")
						.select("layouts")
						.eq("id", userId)
						.single(),
				]);

				const settings = settingsRes.data ?? null;
				const layouts = layoutRes.data?.layouts ?? null;

				set({
					onboardingProfile: {
						age: null,
						interests: [],
						persona: settings?.persona ?? null,
					},
				});

				const visibility = {
					...DEFAULT_VIS,
					...(settings?.vis ?? {}),
				};

				const layoutIds = extractLayoutWidgetIds(layouts);
				if (layoutIds.size > 0) {
					visibleWidgets = [...layoutIds].filter(
						(widgetId) =>
							widgetId.startsWith("smart_") || visibility[widgetId] === true,
					);
				} else {
					visibleWidgets = Object.keys(visibility).filter(
						(widgetId) => visibility[widgetId] === true,
					);
				}
			}
		}

		set({ activeWidgetIds: visibleWidgets });

		const jobs = [];
		if (visibleWidgets.includes("weather"))
			jobs.push(store.fetchWeather(undefined, undefined, userId));
		if (visibleWidgets.includes("stocks")) jobs.push(store.fetchStocks(userId));
		if (visibleWidgets.includes("trends")) jobs.push(store.fetchTrends(userId));
		if (visibleWidgets.includes("restaurants"))
			jobs.push(store.fetchRestaurants("맛집", undefined, undefined, userId));
		if (visibleWidgets.includes("calendar"))
			jobs.push(store.fetchCalendar(userId));
		if (visibleWidgets.includes("health")) jobs.push(store.fetchHealth(userId));

		await Promise.all(jobs);
	},
}));
