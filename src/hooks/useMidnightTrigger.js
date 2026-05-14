import { useEffect, useRef, useCallback } from "react";
import { useDiaryStore } from "../store/useDiaryStore";
import { useTodoStore } from "../store/useTodoStore";
import { useBriefingHistoryStore } from "../store/useBriefingHistoryStore";
import { generateAndSaveDiaryForDate } from "../services/diaryGenerationService";
import { load, save } from "../utils/storage";
import { formatLocalDate, parseDateString, shiftDateString } from "../utils/date";

const LAST_SYNTHESIS_KEY = "mb_last_synthesis_date";
const LAST_ACCESS_KEY = "mb_last_access_date";

/**
 * Lazy diary synthesis on first login of a new day (REQ-AJ-001)
 *
 * - No midnight polling. Synthesis runs when user logs in on a new day.
 * - Uses briefing snapshots saved during the previous day as primary input.
 * - Dates without any snapshots are skipped (no briefing = no data).
 */
export const useMidnightTrigger = (isLoggedIn) => {
	const synthesisInProgress = useRef(false);
	const lastCheckedDate = useRef(null);

	const todayStr = () => formatLocalDate();

	/**
	 * Generate diary for a specific date using stored briefing snapshots
	 */
	const synthesizeDiary = useCallback(async (dateStr) => {
		const { getDiary } = useDiaryStore.getState();
		if (getDiary(dateStr)?.diary) {
			return true;
		}

		const { getSnapshotsForDate, clearDate } = useBriefingHistoryStore.getState();
		const snapshots = getSnapshotsForDate(dateStr);

		// 스냅샷 없으면 그날 접속 안 한 것 → 일기 건너뜀
		if (snapshots.length === 0) {
			return false;
		}

		try {
			const result = await generateAndSaveDiaryForDate(dateStr, {
				overwrite: false,
				wasActiveDay: true,
				briefingSnapshots: snapshots,
			});

			if (result?.ok && result.text) {
				await clearDate(dateStr);
				return true;
			}
		} catch (e) {
			console.warn(`[Diary] Failed to generate diary for ${dateStr}:`, e?.message);
		}
		return false;
	}, []);

	/**
	 * On first login of a new day, synthesize diary for all uncovered past dates
	 */
	const recoverMissedDiaries = useCallback(async () => {
		const lastAccess = load(LAST_ACCESS_KEY, null);
		const today = todayStr();

		if (!lastAccess || lastAccess === today) {
			return;
		}

		const lastDate = parseDateString(lastAccess);
		const todayDate = parseDateString(today);
		const skippedDates = [];

		let current = new Date(lastDate);
		current.setDate(current.getDate() + 1);
		while (current < todayDate) {
			skippedDates.push(formatLocalDate(current));
			current.setDate(current.getDate() + 1);
		}

		// 전날(lastAccess 당일)도 합성 대상
		if (lastAccess && lastAccess !== today) {
			skippedDates.unshift(lastAccess);
		}

		const unique = [...new Set(skippedDates)];
		if (unique.length === 0) return;

		for (const dateStr of unique) {
			await synthesizeDiary(dateStr);
		}
	}, [synthesizeDiary]);

	/**
	 * Daily reset (todo archive): runs once per day on first login
	 */
	const performDailyReset = useCallback(async () => {
		const today = todayStr();
		const lastReset = load(LAST_SYNTHESIS_KEY, null);
		if (lastReset === today) return;

		const { archiveCompletedNonFixed, ensureDailyReset } = useTodoStore.getState();
		try {
			await archiveCompletedNonFixed();
			await ensureDailyReset();
			save(LAST_SYNTHESIS_KEY, today);
		} catch (e) {
			console.warn("[Daily] Reset failed:", e?.message);
		}
	}, []);

	/**
	 * On login: synthesize past diaries + reset todos
	 */
	useEffect(() => {
		if (!isLoggedIn) return;

		const init = async () => {
			if (synthesisInProgress.current) return;
			synthesisInProgress.current = true;
			try {
				await recoverMissedDiaries();
				await performDailyReset();
				save(LAST_ACCESS_KEY, todayStr());
			} finally {
				synthesisInProgress.current = false;
			}
		};

		init();
	}, [isLoggedIn, recoverMissedDiaries, performDailyReset]);

	return { recoverMissedDiaries };
};

export default useMidnightTrigger;
