// @vitest-environment node
import { describe, expect, it } from "vitest";
import settingsSource from "./useSettingsStore.ts?raw";

// 회귀 방지: 설정 저장(syncSettings)이 쓰는 칸이 실제 user_settings 마이그레이션에 있어야 함.
// 없으면 서버 동기화가 실패해 "이 기기에는 저장됐지만 계정 동기화에 실패했습니다" 알림이 뜸 (2026-10-05).
const migrations = import.meta.glob("../../supabase/migrations/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

const userSettingsColumns = (): Set<string> => {
	const cols = new Set<string>();
	for (const sql of Object.values(migrations)) {
		// create table ... user_settings ( ... );
		for (const m of sql.matchAll(/create table if not exists public\.user_settings\s*\(([\s\S]*?)\);/gi)) {
			for (const line of m[1].split("\n")) {
				const col = line.trim().match(/^([a-z_][a-z0-9_]*)\s/i)?.[1];
				if (col && !/^(primary|constraint|unique|foreign)$/i.test(col)) cols.add(col.toLowerCase());
			}
		}
		// alter table public.user_settings add column if not exists x ...
		for (const stmt of sql.matchAll(/alter table public\.user_settings([\s\S]*?);/gi)) {
			for (const c of stmt[1].matchAll(/add column if not exists\s+([a-z_][a-z0-9_]*)/gi)) cols.add(c[1].toLowerCase());
		}
	}
	return cols;
};

const syncedFields = (): Set<string> => {
	const fields = new Set<string>();
	for (const call of settingsSource.matchAll(/syncSettings\(\{([^}]*)\}/g)) {
		for (const f of call[1].matchAll(/([a-z_][a-z0-9_]*)\s*:/gi)) fields.add(f[1]);
	}
	return fields;
};

describe("user_settings columns", () => {
	it("parses the schema and the synced fields", () => {
		expect(Object.keys(migrations).length).toBeGreaterThan(0);
		expect(userSettingsColumns().has("tone")).toBe(true);
		expect(syncedFields().size).toBeGreaterThan(5);
	});

	it("every field written by syncSettings exists in user_settings", () => {
		const cols = userSettingsColumns();
		const missing = [...syncedFields()].filter((f) => !cols.has(f));
		expect(missing).toEqual([]);
	});
});
