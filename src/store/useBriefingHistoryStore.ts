import { create } from "zustand";
import { load, save } from "../utils/storage";
import { supabase, getSessionUser } from "../lib/supabase";
import { isGuest } from "../lib/guest";
import { formatLocalDate, shiftDateString } from "../utils/date";
import { getDiaryEncryptionStatus, isEncryptedBlob, isEncryptionOn, openJson, sealJson } from "../lib/diaryKeyState";

const STORAGE_KEY = "mb_briefing_history";
const SAVE_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3시간
const RETENTION_DAYS = 7; // 오늘 포함 7일

const todayStr = () => formatLocalDate();
/** 보관 하한 날짜 (이 날짜 포함 이후만 유지) */
const cutoffDate = () => shiftDateString(todayStr(), -(RETENTION_DAYS - 1));

export interface BriefingSnapshot {
	capturedAt: string;
	source: "auto" | "refresh";
	text: string;
	summary: string;
	sections: unknown[];
}

type Payload = { text: string; summary: string; sections: unknown[] };
/** 저장 형태: payload는 평문(암호화 꺼짐/레거시) 또는 { enc } */
interface StoredSnapshot {
	capturedAt: string;
	source: "auto" | "refresh";
	payload: unknown;
}
type RawByDate = Record<string, StoredSnapshot[]>;

const toStored = (e: unknown): StoredSnapshot => {
	const o = (e ?? {}) as Record<string, unknown>;
	// 예전 미러는 payload 없이 text/summary/sections가 바로 붙어 있었음
	return {
		capturedAt: o.capturedAt as string,
		source: (o.source as "auto" | "refresh") ?? "auto",
		payload: o.payload ?? { text: o.text ?? "", summary: o.summary ?? "", sections: o.sections ?? [] },
	};
};

const pruneRaw = (raw: RawByDate): RawByDate => {
	const cutoff = cutoffDate();
	return Object.fromEntries(Object.entries(raw).filter(([d]) => d >= cutoff));
};

const loadLocalRaw = (): RawByDate => {
	const stored = load<Record<string, unknown[]>>(STORAGE_KEY, {});
	const raw: RawByDate = {};
	for (const [d, list] of Object.entries(stored)) {
		if (Array.isArray(list)) raw[d] = list.map(toStored);
	}
	return pruneRaw(raw);
};

const fromPayload = (s: StoredSnapshot, p: Partial<Payload>): BriefingSnapshot => ({
	capturedAt: s.capturedAt,
	source: s.source,
	text: p.text ?? "",
	summary: p.summary ?? "",
	sections: p.sections ?? [],
});

/** 동기 복호화 — 평문(레거시/꺼짐)만 읽음. 암호문은 비동기 decryptAll이 처리 */
const plainByDate = (raw: RawByDate): Record<string, BriefingSnapshot[]> => {
	const out: Record<string, BriefingSnapshot[]> = {};
	for (const [d, list] of Object.entries(raw)) {
		const snaps = list.filter((s) => !isEncryptedBlob(s.payload)).map((s) => fromPayload(s, (s.payload ?? {}) as Partial<Payload>));
		if (snaps.length) out[d] = snaps;
	}
	return out;
};

const decryptAll = async (raw: RawByDate): Promise<Record<string, BriefingSnapshot[]>> => {
	const out: Record<string, BriefingSnapshot[]> = {};
	for (const [d, list] of Object.entries(raw)) {
		const snaps: BriefingSnapshot[] = [];
		for (const s of list) {
			try {
				const p = await openJson<Partial<Payload>>(s.payload);
				if (p) snaps.push(fromPayload(s, p));
			} catch {
				// 키가 달라 열 수 없음 — 없는 것으로 취급
			}
		}
		if (snaps.length) out[d] = snaps;
	}
	return out;
};

/** 로컬 미러 기록. 암호화가 켜져 있으면 평문은 봉인(해제 상태)하거나 버림(잠김) */
const writeMirror = async (raw: RawByDate): Promise<void> => {
	if (isGuest()) return;
	const out: RawByDate = {};
	for (const [d, list] of Object.entries(pruneRaw(raw))) {
		const kept: StoredSnapshot[] = [];
		for (const s of list) {
			if (!isEncryptionOn() || isEncryptedBlob(s.payload)) {
				kept.push(s);
				continue;
			}
			try {
				const sealed = await sealJson(s.payload);
				if (sealed) kept.push({ ...s, payload: sealed });
			} catch {
				// 봉인 실패 시 평문을 남기지 않음
			}
		}
		if (kept.length) out[d] = kept;
	}
	save(STORAGE_KEY, out);
};

interface BriefingHistoryState {
	// 복호화된 메모리 뷰: { "2026-05-15": [{ capturedAt, source, text, summary, sections }] }
	byDate: Record<string, BriefingSnapshot[]>;
	// 저장 형태(암호문 포함) — 잠금 해제 후 다시 복호화하기 위해 보관
	raw: RawByDate;
	addSnapshot: (snapshot: Partial<BriefingSnapshot>) => Promise<void>;
	getSnapshotsForDate: (date: string) => BriefingSnapshot[];
	/** 암호문까지 복호화한 최신 결과. 잠김이면 null (읽을 수 없음 — 호출부는 재시도해야 함) */
	getSnapshotsForDateAsync: (date: string) => Promise<BriefingSnapshot[] | null>;
	getLastSavedAt: (date: string) => string | null;
	shouldSave: (source?: "auto" | "refresh") => boolean;
	clearDate: (date: string) => Promise<void>;
	hydrateFromDB: () => Promise<void>;
}

const initialRaw = loadLocalRaw();

export const useBriefingHistoryStore = create<BriefingHistoryState>()((set, get) => ({
	byDate: plainByDate(initialRaw),
	raw: initialRaw,

	addSnapshot: async (snapshot: Partial<BriefingSnapshot>) => {
		// 샘플 브리핑이 일기 합성 입력(localStorage)에 섞이지 않게
		if (isGuest()) return;
		const payload: Payload = {
			text: snapshot.text ?? "",
			summary: snapshot.summary ?? "",
			sections: snapshot.sections ?? [],
		};
		// 암호화 켜짐+잠김이면 null → 저장하지 않음
		let sealed: unknown;
		try {
			sealed = await sealJson(payload);
		} catch {
			return;
		}
		if (!sealed) return;

		const date = todayStr();
		const entry: BriefingSnapshot = {
			capturedAt: new Date().toISOString(),
			source: snapshot.source ?? "auto",
			...payload,
		};
		const stored: StoredSnapshot = { capturedAt: entry.capturedAt, source: entry.source, payload: sealed };
		const raw = { ...get().raw, [date]: [...(get().raw[date] ?? []), stored] };
		set({ raw, byDate: { ...get().byDate, [date]: [...(get().byDate[date] ?? []), entry] } });
		await writeMirror(raw);

		// supabase 동기화 (테이블이 없어도 graceful 처리)
		try {
			if (!supabase) return;
			const user = await getSessionUser();
			if (!user) return;
			await supabase.from("briefing_snapshots").insert({
				user_id: user.id,
				date,
				captured_at: entry.capturedAt,
				source: entry.source,
				payload: sealed,
			});
		} catch {
			// 테이블 미생성 시 조용히 무시
		}
	},

	getSnapshotsForDate: (date: string): BriefingSnapshot[] => {
		return get().byDate[date] ?? [];
	},

	getSnapshotsForDateAsync: async (date: string): Promise<BriefingSnapshot[] | null> => {
		const list = get().raw[date] ?? [];
		if (getDiaryEncryptionStatus() === "locked" && list.some((s) => isEncryptedBlob(s.payload))) return null;
		const byDate = await decryptAll(get().raw);
		set({ byDate });
		return byDate[date] ?? [];
	},

	getLastSavedAt: (date: string): string | null => {
		const list = get().raw[date] ?? [];
		if (list.length === 0) return null;
		return list[list.length - 1].capturedAt;
	},

	shouldSave: (source: "auto" | "refresh" = "auto"): boolean => {
		if (source === "refresh") return true;
		const date = todayStr();
		const lastSaved = get().getLastSavedAt(date);
		if (!lastSaved) return true;
		return Date.now() - new Date(lastSaved).getTime() >= SAVE_INTERVAL_MS;
	},

	clearDate: async (date: string) => {
		const raw = { ...get().raw };
		delete raw[date];
		const byDate = { ...get().byDate };
		delete byDate[date];
		set({ raw, byDate });
		await writeMirror(raw);

		try {
			if (!supabase) return;
			const user = await getSessionUser();
			if (!user) return;
			await supabase.from("briefing_snapshots").delete().eq("user_id", user.id).eq("date", date);
		} catch {
			// 조용히 무시
		}
	},

	hydrateFromDB: async () => {
		try {
			if (!supabase) return;
			const user = await getSessionUser();
			if (!user) return;
			const cutoff = cutoffDate();
			const { data, error } = await supabase
				.from("briefing_snapshots")
				.select("date, captured_at, source, payload")
				.eq("user_id", user.id)
				.gte("date", cutoff)
				.order("captured_at", { ascending: true });
			if (error || !Array.isArray(data)) return;

			// 7일 지난 행은 서버에서도 삭제 (RLS: 본인 행만)
			void supabase.from("briefing_snapshots").delete().eq("user_id", user.id).lt("date", cutoff).then(() => undefined, () => undefined);

			const raw: RawByDate = {};
			for (const row of data) {
				const d = row.date as string;
				(raw[d] ??= []).push({
					capturedAt: row.captured_at as string,
					source: row.source as "auto" | "refresh",
					payload: row.payload,
				});
			}
			set({ raw, byDate: await decryptAll(raw) });
			await writeMirror(raw);
		} catch {
			// 조용히 무시
		}
	},
}));
