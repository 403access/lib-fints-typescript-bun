import type { Session } from "../types";

export async function handleGetAccountStatements(
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
	const res = await session.client.getAccountStatements(
		accountNumber as string,
	);
	if (res.requiresTan) {
		session.pending = {
			op: "statements",
			accountNumber: accountNumber as string,
		};
		return new Response(JSON.stringify(res), { headers });
	}

	return new Response(JSON.stringify(res), { headers });
}
