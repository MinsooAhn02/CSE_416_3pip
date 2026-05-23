import { useEffect, useRef, useCallback } from "react";
import { useDiaryStore } from "../store/useDiaryStore";
import { useTodoStore } from "../store/useTodoStore";
import { useBriefingHistoryStore } from "../store/useBriefingHistoryStore";
import { generateAndSaveDiaryForDate } from "../services/diaryGenerationService";
import { load, save } from "../utils/storage";
import { formatLocalDate, parseDateString } from "../utils/date";

const LAST_SYNTHESIS_KEY = "mb_last_synthesis_date";
const LAST_ACCESS_KEY = "mb_last_access_date";

export const useMidnightTrigger = (isLoggedIn: boolean) => {
	const synthesisInProgress = useRef(false);
	const lastCheckedDate = useRef<string | null>(null);

	void lastCheckedDate; // referenced for future use

	const todayStr = (): string => formatLocalDate();

	const synthesizeDiary = useCallback(async (dateStr: string): Promise<boolean> => {
		const { getDiary } = useDiaryStore.getState();
		if ((getDiary as ((d: string) => { diary?: string } | null) | undefined)?.(dateStr)?.diary) {
			return true;
		}

		const { getSnapshotsForDate, clearDate } = useBriefingHistoryStore.getState();
		const snapshots = getSnapshotsForDate(dateStr);

		if (snapshots.length === 0) {
			return false;
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
				return true;
			}
		} catch (e) {
			console.warn(`[Diary] Failed to generate diary for ${dateStr}:`, (e as Error)?.message);
		}
		return false;
	}, []);

	const recoverMissedDiaries = useCallback(async (): Promise<void> => {
		const lastAccess = load<string | null>(LAST_ACCESS_KEY, null);
		const today = todayStr();

		if (!lastAccess || lastAccess === today) {
			return;
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
		if (unique.length === 0) return;

		for (const dateStr of unique) {
			await synthesizeDiary(dateStr);
		}
	}, [synthesizeDiary]);

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

		const init = async (): Promise<void> => {
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

		void init();
	}, [isLoggedIn, recoverMissedDiaries, performDailyReset]);

	return { recoverMissedDiaries };
};

export default useMidnightTrigger;
