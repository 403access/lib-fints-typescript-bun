import type { Session } from "../types";

export async function handleSelectTan(
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

	const { tanMethodId, tanMediaName } = payload || {};
	if (tanMethodId) session.client.selectTanMethod(Number(tanMethodId));
	if (tanMediaName) session.client.selectTanMedia(tanMediaName as string);

	const bankingInformation = session.config?.bankingInformation || null;
	return new Response(JSON.stringify({ bankingInformation }), { headers });
}
