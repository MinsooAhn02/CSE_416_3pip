// TODO: Replace with real API endpoints
const BASE_URL = "/api";

export async function apiFetch(path, options = {}) {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: { "Content-Type": "application/json", ...options.headers },
		...options,
	});
	if (!res.ok) throw new Error(`API ${res.status}`);
	return res.json();
}
