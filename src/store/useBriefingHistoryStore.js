import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "mb_briefing_history";
const SAVE_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3시간

const todayStr = () => new Date().toISOString().slice(0, 10);

const loadLocal = () => load(STORAGE_KEY, {});
const saveLocal = (byDate) => save(STORAGE_KEY, byDate);

export const useBriefingHistoryStore = create((set, get) => ({
	// { "2026-05-15": [{ capturedAt: ISO, source: "auto"|"refresh", text, sections, summary }] }
	byDate: loadLocal(),

	addSnapshot: async (snapshot) => {
		const date = todayStr();
		const current = get().byDate;
		const existing = current[date] ?? [];
		const entry = {
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

	getSnapshotsForDate: (date) => {
		return get().byDate[date] ?? [];
	},

	getLastSavedAt: (date) => {
		const snaps = get().byDate[date] ?? [];
		if (snaps.length === 0) return null;
		return snaps[snaps.length - 1].capturedAt;
	},

	shouldSave: (source = "auto") => {
		if (source === "refresh") return true;
		const date = todayStr();
		const lastSaved = get().getLastSavedAt(date);
		if (!lastSaved) return true;
		return Date.now() - new Date(lastSaved).getTime() >= SAVE_INTERVAL_MS;
	},

	clearDate: async (date) => {
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

			const byDate = {};
			for (const row of data) {
				const d = row.date;
				if (!byDate[d]) byDate[d] = [];
				byDate[d].push({
					capturedAt: row.captured_at,
					source: row.source,
					text: row.payload?.text ?? "",
					summary: row.payload?.summary ?? "",
					sections: row.payload?.sections ?? [],
				});
			}
			set({ byDate });
			saveLocal(byDate);
		} catch {
			// 조용히 무시
		}
	},
}));
