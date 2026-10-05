/**
 * Google API 오류 응답 요약. 업스트림 본문은 서버 로그에만 남기고 클라이언트에는
 * "<서비스> <status> [reason]"만 반환 (reason은 Google 오류 JSON의 짧은 코드만 — 자유 텍스트 금지).
 * 클라이언트가 "401"/"403"/"insufficientPermissions"/"accessNotConfigured" 등으로 판별하므로 형식 유지.
 */
export const googleErrorSummary = async (service: string, res: Response, tag: string): Promise<string> => {
	const text = await res.text();
	console.error(`[${tag}] ${service} ${res.status}:`, text.slice(0, 500));
	let reason = "";
	try {
		const err = JSON.parse(text)?.error;
		reason = String(err?.errors?.[0]?.reason || err?.status || "");
	} catch { /* JSON 아님 */ }
	if (!/^[A-Za-z_]{1,40}$/.test(reason)) reason = "";
	return `${service} ${res.status}${reason ? ` ${reason}` : ""}`;
};
