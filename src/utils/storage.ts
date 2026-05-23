export const load = <T>(k: string, fb: T): T => {
	try {
		const v = localStorage.getItem(k);
		return v !== null ? (JSON.parse(v) as T) : fb;
	} catch {
		return fb;
	}
};

export const save = (k: string, v: unknown): void =>
	void localStorage.setItem(k, JSON.stringify(v));
