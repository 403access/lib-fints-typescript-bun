import type { Session } from "../types";

export async function handleGetAllStatements(
	session: Session,
	headers: HeadersInit,
): Promise<Response> {
	if (!session.client) {
		return new Response(JSON.stringify({ error: "No active session" }), {
			status: 400,
			headers,
		});
	}

	const accounts = session.config?.bankingInformation?.upd?.bankAccounts || [];
	if (accounts.length === 0) {
		return new Response(
			JSON.stringify({ error: "No accounts found. Please synchronize first." }),
			{ status: 400, headers },
		);
	}

	try {
		// For now, we'll use the first account to check if TAN is required
		// In a real implementation, you might want to check each account or use a different strategy
		const firstAccount = accounts[0];
		const res = await session.client.getAccountStatements(
			firstAccount.accountNumber,
		);

		if (res.requiresTan) {
			session.pending = { op: "getAllStatements" };
			return new Response(
				JSON.stringify({
					...res,
					tanChallenge:
						res.tanChallenge || "TAN required for batch statements retrieval",
				}),
				{ headers },
			);
		}

		// If no TAN required, get all statements immediately
		const statements: Record<string, unknown> = {};

		for (const account of accounts) {
			try {
				const statementsRes = await session.client.getAccountStatements(
					account.accountNumber,
				);
				if (
					statementsRes &&
					typeof statementsRes === "object" &&
					"data" in statementsRes
				) {
					statements[account.accountNumber] = statementsRes.data;
				}
			} catch (error) {
				console.warn(
					`Failed to get statements for account ${account.accountNumber}:`,
					error,
				);
			}
		}

		return new Response(JSON.stringify({ success: true, data: statements }), {
			headers,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 400,
			headers,
		});
	}
}
