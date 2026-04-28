import { useEffect, useRef, useCallback } from "react";
import { useDiaryStore } from "../store/useDiaryStore";
import { useTodoStore } from "../store/useTodoStore";
import { generateAndSaveDiaryForDate } from "../services/diaryGenerationService";
import { load, save } from "../utils/storage";
import { formatLocalDate, parseDateString, shiftDateString } from "../utils/date";

const LAST_SYNTHESIS_KEY = "mb_last_synthesis_date";
const LAST_ACCESS_KEY = "mb_last_access_date";
const POLLING_INTERVAL_MS = 60 * 1000; // 60 seconds (REQ-CS-005)

/**
 * Midnight Auto-Synthesis Trigger Hook (REQ-AJ-001, REQ-CS-005)
 * 
 * Features:
 * 1. 60-second polling to detect 00:00 in local timezone
 * 2. Collects checked TODOs, calendar events, daily question, macro data
 * 3. Generates objective, factual diary entry via Groq LLM
 * 4. Handles missed days when browser was closed (sequential recovery)
 */
export const useMidnightTrigger = (isLoggedIn) => {
	const synthesisInProgress = useRef(false);
	const lastCheckedDate = useRef(null);

	const todayStr = () => formatLocalDate();

	/**
	 * Generate diary for a specific date (REQ-AJ-003)
	 */
	const synthesizeDiary = useCallback(async (dateStr, wasActiveDay = true) => {
		const { getDiary } = useDiaryStore.getState();
		
		// Skip if diary already exists (idempotency)
		if (getDiary(dateStr)?.diary) {
			console.log(`[Midnight] Diary already exists for ${dateStr}, skipping`);
			return true;
		}
		
		try {
			const result = await generateAndSaveDiaryForDate(dateStr, {
				overwrite: false,
				wasActiveDay,
			});

			if (result?.ok && result.text) {
				console.log(`[Midnight] Diary generated for ${dateStr}`);
				return true;
			}
		} catch (e) {
			console.warn(`[Midnight] Failed to generate diary for ${dateStr}:`, e?.message);
		}
		return false;
	}, []);

	/**
	 * Recover missed diaries for skipped dates (Option A)
	 * Compares last access date with today and fills gaps
	 */
	const recoverMissedDiaries = useCallback(async () => {
		const lastAccess = load(LAST_ACCESS_KEY, null);
		const today = todayStr();

		if (!lastAccess || lastAccess === today) {
			return;
		}

		// Calculate skipped dates
		const lastDate = parseDateString(lastAccess);
		const todayDate = parseDateString(today);
		const skippedDates = [];

		let current = new Date(lastDate);
		current.setDate(current.getDate() + 1);

		while (current < todayDate) {
			skippedDates.push(formatLocalDate(current));
			current.setDate(current.getDate() + 1);
		}

		if (skippedDates.length === 0) {
			return;
		}

		console.log(`[Midnight] Recovering ${skippedDates.length} missed diaries:`, skippedDates);

		// Generate diaries sequentially for each skipped date
		for (const dateStr of skippedDates) {
			await synthesizeDiary(dateStr, false); // wasActiveDay = false
		}
	}, [synthesizeDiary]);

	/**
	 * Perform daily reset at midnight (REQ-CS-004)
	 */
	const performDailyReset = useCallback(async () => {
		const { archiveCompletedNonFixed, ensureDailyReset } = useTodoStore.getState();
		
		try {
			await archiveCompletedNonFixed();
			await ensureDailyReset();
			console.log("[Midnight] Daily reset completed");
		} catch (e) {
			console.warn("[Midnight] Daily reset failed:", e?.message);
		}
	}, []);

	/**
	 * Main midnight trigger handler
	 */
	const handleMidnightTrigger = useCallback(async () => {
		if (synthesisInProgress.current) return;
		synthesisInProgress.current = true;

		const today = todayStr();
		const lastSynthesis = load(LAST_SYNTHESIS_KEY, null);

		// Check if we already synthesized today (idempotency)
		if (lastSynthesis === today) {
			synthesisInProgress.current = false;
			return;
		}

		try {
			// Generate yesterday's diary
			const yesterdayStr = shiftDateString(today, -1);

			const success = await synthesizeDiary(yesterdayStr, true);
			
			if (success) {
				save(LAST_SYNTHESIS_KEY, today);
				await performDailyReset();
			}
		} finally {
			synthesisInProgress.current = false;
		}
	}, [synthesizeDiary, performDailyReset]);

	/**
	 * 60-second polling to detect midnight (REQ-CS-005)
	 */
	useEffect(() => {
		if (!isLoggedIn) return;

		const checkMidnight = () => {
			const now = new Date();
			const currentDate = formatLocalDate(now);
			const hours = now.getHours();
			const minutes = now.getMinutes();

			// Check if it's within 1 minute of midnight (00:00 - 00:01)
			if (hours === 0 && minutes === 0 && lastCheckedDate.current !== currentDate) {
				lastCheckedDate.current = currentDate;
				handleMidnightTrigger();
			}
		};

		// Initial check
		checkMidnight();

		// Set up polling interval
		const intervalId = setInterval(checkMidnight, POLLING_INTERVAL_MS);

		return () => clearInterval(intervalId);
	}, [isLoggedIn, handleMidnightTrigger]);

	/**
	 * On mount: Update last access date and recover missed diaries
	 */
	useEffect(() => {
		if (!isLoggedIn) return;

		const init = async () => {
			// Recover any missed diaries first
			await recoverMissedDiaries();
			
			// Update last access date to today
			save(LAST_ACCESS_KEY, todayStr());
		};

		init();
	}, [isLoggedIn, recoverMissedDiaries]);

	return {
		triggerSynthesis: handleMidnightTrigger,
		recoverMissedDiaries,
	};
};

export default useMidnightTrigger;
