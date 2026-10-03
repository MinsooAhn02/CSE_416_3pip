// 둘러보기(게스트) 모드 플래그. 메모리 전용 — 새로고침하면 로그인 화면으로 돌아감.
// 게스트일 때 Edge Function 호출 헬퍼들이 즉시 null을 반환 → 외부 API 비용 0.
let guest = false;

export const isGuest = (): boolean => guest;
export const setGuest = (value: boolean): void => {
	guest = value;
};
