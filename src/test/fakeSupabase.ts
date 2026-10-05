/* eslint-disable @typescript-eslint/no-explicit-any */
// In-memory fake of the supabase query builder (only what the diary/briefing stores call).
// Every write is also appended to `writes` so tests can assert that no plaintext ever went out.
type Row = Record<string, any>;
export interface WriteLog { table: string; op: "insert" | "upsert" | "update" | "delete"; rows: Row[] }

export const createFakeSupabase = (seed: Record<string, Row[]> = {}) => {
	const db: Record<string, Row[]> = Object.fromEntries(
		Object.entries(seed).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))]),
	);
	const writes: WriteLog[] = [];
	let nextId = 1;

	const from = (table: string) => {
		const rows = (db[table] ??= []);
		let op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
		let payload: Row[] = [];
		let patch: Row = {};
		let onConflict = "id";
		let single: "single" | "maybe" | null = null;
		let wantsReturn = false;
		const filters: ((r: Row) => boolean)[] = [];
		let orderBy: { col: string; asc: boolean } | null = null;
		let range: [number, number] | null = null;

		const exec = (): { data: any; error: null } => {
			if (op === "insert") {
				const added = payload.map((p) => ({ id: `id${nextId++}`, ...p }));
				rows.push(...added);
				writes.push({ table, op, rows: payload });
				return { data: null, error: null };
			}
			if (op === "upsert") {
				const cols = onConflict.split(",");
				for (const p of payload) {
					const hit = rows.find((r) => cols.every((c) => r[c] === p[c]));
					if (hit) Object.assign(hit, p);
					else rows.push({ id: `id${nextId++}`, ...p });
				}
				writes.push({ table, op, rows: payload });
				return { data: null, error: null };
			}
			const hits = rows.filter((r) => filters.every((f) => f(r)));
			if (op === "update") {
				hits.forEach((r) => Object.assign(r, patch));
				writes.push({ table, op, rows: [patch] });
				return { data: wantsReturn ? hits.map((r) => ({ ...r })) : null, error: null };
			}
			if (op === "delete") {
				db[table] = rows.filter((r) => !hits.includes(r));
				writes.push({ table, op, rows: hits });
				return { data: null, error: null };
			}
			let out = hits.map((r) => ({ ...r }));
			if (orderBy) {
				const { col, asc } = orderBy;
				out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
			}
			if (range) out = out.slice(range[0], range[1] + 1);
			if (single) return { data: out[0] ?? null, error: null };
			return { data: out, error: null };
		};

		const q: any = {
			select: () => { wantsReturn = true; return q; },
			insert: (r: Row | Row[]) => { op = "insert"; payload = [r].flat(); return q; },
			upsert: (r: Row | Row[], o?: { onConflict?: string }) => { op = "upsert"; payload = [r].flat(); onConflict = o?.onConflict ?? "id"; return q; },
			update: (p: Row) => { op = "update"; patch = p; return q; },
			delete: () => { op = "delete"; return q; },
			eq: (c: string, v: any) => { filters.push((r) => r[c] === v); return q; },
			gte: (c: string, v: any) => { filters.push((r) => r[c] >= v); return q; },
			lt: (c: string, v: any) => { filters.push((r) => r[c] < v); return q; },
			order: (c: string, o?: { ascending?: boolean }) => { orderBy = { col: c, asc: o?.ascending !== false }; return q; },
			range: (a: number, b: number) => { range = [a, b]; return q; },
			maybeSingle: () => { single = "maybe"; return q; },
			single: () => { single = "single"; return q; },
			throwOnError: () => q,
			then: (res: (v: any) => any, rej?: (e: any) => any) => Promise.resolve().then(exec).then(res, rej),
		};
		return q;
	};

	const client = {
		from,
		auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } }, error: null }) },
	};
	return { client, db, writes };
};
