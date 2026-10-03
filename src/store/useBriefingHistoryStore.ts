import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";
import { isGuest } from "../lib/guest";
import { formatLocalDate } from "../utils/date";

const STORAGE_KEY = "mb_briefing_history";
const SAVE_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3시간

const todayStr = () => formatLocalDate();

const loadLocal = (): Record<string, BriefingSnapshot[]> => load(STORAGE_KEY, {});
const saveLocal = (byDate: Record<string, BriefingSnapshot[]>) => save(STORAGE_KEY, byDate);

export interface BriefingSnapshot {
	capturedAt: string;
	source: "auto" | "refresh";
	text: string;
	summary: string;
	sections: unknown[];
}

interface BriefingHistoryState {
	// { "2026-05-15": [{ capturedAt: ISO, source: "auto"|"refresh", text, sections, summary }] }
	byDate: Record<string, BriefingSnapshot[]>;
	addSnapshot: (snapshot: Partial<BriefingSnapshot>) => Promise<void>;
	getSnapshotsForDate: (date: string) => BriefingSnapshot[];
	getLastSavedAt: (date: string) => string | null;
	shouldSave: (source?: "auto" | "refresh") => boolean;
	clearDate: (date: string) => Promise<void>;
	hydrateFromDB: () => Promise<void>;
}

export const useBriefingHistoryStore = create<BriefingHistoryState>()((set, get) => ({
	byDate: loadLocal(),

	addSnapshot: async (snapshot: Partial<BriefingSnapshot>) => {
		// 샘플 브리핑이 일기 합성 입력(localStorage)에 섞이지 않게
		if (isGuest()) return;
		const date = todayStr();
		const current = get().byDate;
		const existing = current[date] ?? [];
		const entry: BriefingSnapshot = {
			capturedAt: new Date().toISOString(),
			source: snapshot.source ?? "auto",
			text: snapshot.text ?? "",
			summary: snapshot.summary ?? "",
			sections: snapshot.sections ?? [],
		};
		const updated = { ...current, [date]: [...existing, entry] };
		set({ byDate: updated });
		saveLocal(updated);

		// supabase 동기화 (테이블이 없어도 graceful 처리)
		try {
			if (!supabase) return;
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;
			await supabase.from("briefing_snapshots").insert({
				user_id: user.id,
				date,
				captured_at: entry.capturedAt,
				source: entry.source,
				payload: { text: entry.text, summary: entry.summary, sections: entry.sections },
			});
		} catch {
			// 테이블 미생성 시 조용히 무시
		}
	},

	getSnapshotsForDate: (date: string): BriefingSnapshot[] => {
		return get().byDate[date] ?? [];
	},

	getLastSavedAt: (date: string): string | null => {
		const snaps = get().byDate[date] ?? [];
		if (snaps.length === 0) return null;
		return snaps[snaps.length - 1].capturedAt;
	},

	shouldSave: (source: "auto" | "refresh" = "auto"): boolean => {
		if (source === "refresh") return true;
		const date = todayStr();
		const lastSaved = get().getLastSavedAt(date);
		if (!lastSaved) return true;
		return Date.now() - new Date(lastSaved).getTime() >= SAVE_INTERVAL_MS;
	},

	clearDate: async (date: string) => {
		const current = get().byDate;
		const updated = { ...current };
		delete updated[date];
		set({ byDate: updated });
		saveLocal(updated);

		try {
			if (!supabase) return;
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;
			await supabase.from("briefing_snapshots").delete().eq("user_id", user.id).eq("date", date);
		} catch {
			// 조용히 무시
		}
	},

	hydrateFromDB: async () => {
		try {
			if (!supabase) return;
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;
			const { data, error } = await supabase
				.from("briefing_snapshots")
				.select("date, captured_at, source, payload")
				.eq("user_id", user.id)
				.order("captured_at", { ascending: true });
			if (error || !Array.isArray(data)) return;

			const byDate: Record<string, BriefingSnapshot[]> = {};
			for (const row of data) {
				const d = row.date as string;
				if (!byDate[d]) byDate[d] = [];
				byDate[d].push({
					capturedAt: row.captured_at as string,
					source: row.source as "auto" | "refresh",
					text: (row.payload as Record<string, unknown>)?.text as string ?? "",
					summary: (row.payload as Record<string, unknown>)?.summary as string ?? "",
					sections: (row.payload as Record<string, unknown>)?.sections as unknown[] ?? [],
				});
			}
			set({ byDate });
			saveLocal(byDate);
		} catch {
			// 조용히 무시
		}
	},
}));
