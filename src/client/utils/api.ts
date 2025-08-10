// FinTS API client

export const API_URL = "/api/fints"; // change if needed

export async function api<T>(body: Record<string, unknown>): Promise<T> {
	const res = await fetch(API_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		credentials: "include",
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()) as T;
}
