import { useEffect, useRef, useCallback } from "react";
import { useDiaryStore } from "../store/useDiaryStore";
import { useTodoStore } from "../store/useTodoStore";
import { useBriefingHistoryStore } from "../store/useBriefingHistoryStore";
import { generateAndSaveDiaryForDate } from "../services/diaryGenerationService";
import { load, save } from "../utils/storage";
import { formatLocalDate, parseDateString, shiftDateString } from "../utils/date";

const LAST_SYNTHESIS_KEY = "mb_last_synthesis_date";
const LAST_ACCESS_KEY = "mb_last_access_date";

// done: 생성됨/이미 있음, skip: 스냅샷 없음(영구), error: 재시도 필요
type DiaryOutcome = "done" | "skip" | "error";

const todayStr = (): string => formatLocalDate();

export const synthesizeDiary = async (dateStr: string): Promise<DiaryOutcome> => {
	const { getDiary } = useDiaryStore.getState();
	if ((getDiary as ((d: string) => { diary?: string } | null) | undefined)?.(dateStr)?.diary) {
		return "done";
	}

	const { getSnapshotsForDateAsync, clearDate } = useBriefingHistoryStore.getState();
	// null = 잠겨서 스냅샷을 열 수 없음 — 있을 수도 있으니 영구 skip이 아니라 재시도
	const snapshots = await getSnapshotsForDateAsync(dateStr);
	if (snapshots === null) return "error";

	// 스냅샷 없음은 영구 조건 — 재시도해도 소용없으므로 진행을 막지 않는다
	if (snapshots.length === 0) {
		return "skip";
	}

	try {
		const result = await generateAndSaveDiaryForDate(dateStr, {
			overwrite: false,
			wasActiveDay: true,
			briefingSnapshots: snapshots,
		});

		if ((result as { ok?: boolean; text?: string } | null)?.ok &&
			(result as { ok?: boolean; text?: string }).text) {
			await clearDate(dateStr);
			return "done";
		}
	} catch (e) {
		console.warn(`[Diary] Failed to generate diary for ${dateStr}:`, (e as Error)?.message);
	}
	return "error";
};

export const recoverMissedDiaries = async (): Promise<string | null> => {
	const lastAccess = load<string | null>(LAST_ACCESS_KEY, null);
	const today = todayStr();

	if (!lastAccess || lastAccess === today) {
		return null;
	}

	const lastDate = parseDateString(lastAccess);
	const todayDate = parseDateString(today);
	const skippedDates: string[] = [];

	const current = new Date(lastDate);
	current.setDate(current.getDate() + 1);
	while (current < todayDate) {
		skippedDates.push(formatLocalDate(current));
		current.setDate(current.getDate() + 1);
	}

	if (lastAccess && lastAccess !== today) {
		skippedDates.unshift(lastAccess);
	}

	const unique = [...new Set(skippedDates)];
	if (unique.length === 0) return null;

	for (const dateStr of unique) {
		// 실패한 첫 날짜를 반환 — 호출부가 LAST_ACCESS를 그 전날까지만 올려 다음 실행에서 재시도
		if ((await synthesizeDiary(dateStr)) === "error") return dateStr;
	}
	return null;
};

/** 실패한 첫 날짜가 있으면 그 전날, 없으면 오늘 — 다음 실행에서 실패 날짜부터 재시도 */
export const nextLastAccess = (failedDate: string | null, today: string): string =>
	failedDate ? shiftDateString(failedDate, -1) : today;

export const useMidnightTrigger = (isLoggedIn: boolean) => {
	const synthesisInProgress = useRef(false);
	const lastProcessedDate = useRef<string | null>(null);

	const performDailyReset = useCallback(async (): Promise<void> => {
		const today = todayStr();
		const lastReset = load<string | null>(LAST_SYNTHESIS_KEY, null);
		if (lastReset === today) return;

		const calendarState = useTodoStore.getState() as unknown as Record<string, unknown>;
		const archiveCompletedNonFixed = calendarState.archiveCompletedNonFixed as (() => Promise<void>) | undefined;
		const ensureDailyReset = calendarState.ensureDailyReset as (() => Promise<void>) | undefined;
		try {
			await archiveCompletedNonFixed?.();
			await ensureDailyReset?.();
			save(LAST_SYNTHESIS_KEY, today);
		} catch (e) {
			console.warn("[Daily] Reset failed:", (e as Error)?.message);
		}
	}, []);

	useEffect(() => {
		if (!isLoggedIn) return;

		const run = async (): Promise<void> => {
			if (synthesisInProgress.current) return;
			const today = todayStr();
			if (lastProcessedDate.current === today) return;
			synthesisInProgress.current = true;
			try {
				const failedDate = await recoverMissedDiaries();
				await performDailyReset();
				save(LAST_ACCESS_KEY, nextLastAccess(failedDate, today));
				// 실패해도 오늘은 다시 시도하지 않음(AI 호출 반복 방지) — 다음 로그인/날짜 변경 때 재시도
				lastProcessedDate.current = today;
			} finally {
				synthesisInProgress.current = false;
			}
		};

		const onVisible = (): void => {
			if (document.visibilityState === "visible") void run();
		};

		void run();
		document.addEventListener("visibilitychange", onVisible);
		const timer = window.setInterval(() => void run(), 60_000);
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			window.clearInterval(timer);
			lastProcessedDate.current = null; // 재로그인 시 다시 실행
		};
	}, [isLoggedIn, performDailyReset]);

	return { recoverMissedDiaries };
};

export default useMidnightTrigger;
