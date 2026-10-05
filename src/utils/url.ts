/**
 * 외부 데이터(검색 결과·AI 응답·Google 응답)의 URL을 href/window.open에 넣기 전에 검사.
 * http/https만 통과 — `javascript:` 같은 주소가 섞여 오면 클릭 시 앱 origin에서 스크립트가 실행됨.
 * 통과 못 하면 "" → 호출부는 링크 없이 텍스트만 표시.
 */
export const safeExternalUrl = (url: unknown): string => {
	const raw = String(url ?? "").trim();
	if (!raw) return "";
	try {
		const { protocol } = new URL(raw);
		return protocol === "http:" || protocol === "https:" ? raw : "";
	} catch {
		return ""; // 상대 경로·깨진 주소
	}
};
