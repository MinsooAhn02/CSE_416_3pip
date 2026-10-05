


/* ── 위치 캐시 (module scope) ──
 * Geolocation을 매 refresh마다 다시 호출하면 브라우저 권한 상태에 따라
 * 6초까지 블록될 수 있고, 최악의 경우 resolve/reject 중 어느 쪽도 호출되지
 * 않아 fetch 함수가 영원히 hang 되는 문제가 있었음.
 * → 첫 호출 시 위치를 얻어 module scope에 캐시 (5분), 이후에는 즉시 반환.
 *   내부적으로 hard timeout(6.5s) race를 걸어 hang을 방지.
 */
export interface GeoCache { lat: number; lon: number; at: number }
let _geoCache: GeoCache | null = null;
export const GEO_CACHE_MS = 5 * 60 * 1000;

export const getGeoPosition = async (): Promise<{ lat: number; lon: number } | null> => {
	if (_geoCache && Date.now() - _geoCache.at < GEO_CACHE_MS) {
		return { lat: _geoCache.lat, lon: _geoCache.lon };
	}
	if (typeof navigator === "undefined" || !navigator.geolocation) return null;
	try {
		const pos = await Promise.race([
			new Promise<GeolocationPosition>((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					timeout: 6000,
					maximumAge: GEO_CACHE_MS,
				}),
			),
			new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new Error("geolocation hard-timeout")),
					6500,
				),
			),
		]);
		_geoCache = {
			lat: pos.coords.latitude,
			lon: pos.coords.longitude,
			at: Date.now(),
		};
		return { lat: _geoCache.lat, lon: _geoCache.lon };
	} catch {
		return null;
	}
};

/* ── DB 캐시 헬퍼 (api_cache 테이블) ── */
/** Auth store에서 동기적으로 userId를 읽는다. 네트워크 요청 없음. */
