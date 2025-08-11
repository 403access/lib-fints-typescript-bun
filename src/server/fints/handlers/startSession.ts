import { FinTSClient, FinTSConfig } from "lib-fints";
import type { Session } from "../types";

export async function handleStartSession(
	session: Session,
	payload: Record<string, unknown>,
	headers: HeadersInit,
): Promise<Response> {
	const { productId, productVersion, bankUrl, bankId, userId, pin } = payload;

	const config = FinTSConfig.forFirstTimeUse(
		productId as string,
		productVersion as string,
		bankUrl as string,
		bankId as string,
		userId as string,
		pin as string,
	);

	const client = new FinTSClient(config);
	session.client = client;
	session.config = config;

	// Perform initial synchronization to get banking information
	try {
		const syncRes = await client.synchronize();
		if (syncRes.requiresTan) {
			// If TAN is required for initial sync, store the pending operation
			session.pending = { op: "sync" };
			return new Response(
				JSON.stringify({
					bankingInformation: config.bankingInformation || null,
					requiresTan: true,
					tanChallenge: syncRes.tanChallenge,
					tanReference: syncRes.tanReference,
					bankAnswers: syncRes.bankAnswers,
				}),
				{ headers },
			);
		}
		// Sync completed, return the banking information
		return new Response(
			JSON.stringify({
				bankingInformation: config.bankingInformation || null,
			}),
			{ headers },
		);
	} catch (error) {
		// If sync fails, still return the session but with null banking info
		console.warn("Initial sync failed:", error);
		return new Response(
			JSON.stringify({
				bankingInformation: null,
				error: error instanceof Error ? error.message : String(error),
			}),
			{ headers },
		);
	}
}
