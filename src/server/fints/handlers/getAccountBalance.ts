import type { Session } from "../types";

export async function handleGetAccountBalance(
	session: Session,
	payload: Record<string, unknown>,
	headers: HeadersInit,
): Promise<Response> {
	if (!session.client) {
		return new Response(JSON.stringify({ error: "No active session" }), {
			status: 400,
			headers,
		});
	}

	const { accountNumber } = payload || {};
	const res = await session.client.getAccountBalance(accountNumber as string);
	if (res.requiresTan) {
		session.pending = { op: "balance", accountNumber: accountNumber as string };
		return new Response(JSON.stringify(res), { headers });
	}

	return new Response(JSON.stringify(res), { headers });
}
