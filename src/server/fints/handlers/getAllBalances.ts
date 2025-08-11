import type { Session } from "../types";

export async function handleGetAllBalances(
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
		const res = await session.client.getAccountBalance(
			firstAccount.accountNumber,
		);

		if (res.requiresTan) {
			session.pending = { op: "getAllBalances" };
			return new Response(
				JSON.stringify({
					...res,
					tanChallenge:
						res.tanChallenge || "TAN required for batch balance retrieval",
				}),
				{ headers },
			);
		}

		// If no TAN required, get all balances immediately
		const balances: Record<string, unknown> = {};

		for (const account of accounts) {
			try {
				const balanceRes = await session.client.getAccountBalance(
					account.accountNumber,
				);
				if (
					balanceRes &&
					typeof balanceRes === "object" &&
					"data" in balanceRes
				) {
					balances[account.accountNumber] = balanceRes.data;
				}
			} catch (error) {
				console.warn(
					`Failed to get balance for account ${account.accountNumber}:`,
					error,
				);
			}
		}

		return new Response(JSON.stringify({ success: true, data: balances }), {
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
