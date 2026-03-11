export const load = (k, fb) => {
	try {
		const v = localStorage.getItem(k);
		return v !== null ? JSON.parse(v) : fb;
	} catch {
		return fb;
	}
};

export const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
