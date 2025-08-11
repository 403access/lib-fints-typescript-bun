import type { Session } from "../types";

export async function handleSynchronize(
	session: Session,
	headers: HeadersInit,
): Promise<Response> {
	if (!session.client) {
		return new Response(JSON.stringify({ error: "No active session" }), {
			status: 400,
			headers,
		});
	}

	const res = await session.client.synchronize();
	if (res.requiresTan) {
		session.pending = { op: "sync" };
		return new Response(JSON.stringify(res), { headers });
	}

	const bankingInformation = session.config?.bankingInformation;
	if (!bankingInformation) {
		throw new Error("Banking information not available");
	}

	const response = {
		...res,
		data: { bankingInformation },
	};

	return new Response(JSON.stringify(response), { headers });
}
