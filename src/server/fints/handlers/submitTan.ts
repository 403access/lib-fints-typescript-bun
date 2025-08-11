import type { Session } from "../types";

export async function handleSubmitTan(
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

	const { tan, tanReference, op } = payload || {};
	if (!session.pending || session.pending.op !== op) {
		return new Response(JSON.stringify({ error: "No pending TAN op" }), {
			status: 400,
			headers,
		});
	}

	let res: unknown;

	try {
		if (op === "sync") {
			// For decoupled TAN methods, tan can be undefined/empty
			res = await session.client.synchronizeWithTan(
				tanReference as string,
				(tan as string) || undefined,
			);
			// Add banking information to sync response
			if (res && typeof res === "object" && "success" in res && res.success) {
				const bankingInformation = session.config?.bankingInformation;
				if (bankingInformation) {
					(res as Record<string, unknown>).data = { bankingInformation };
				}
			}
		} else if (op === "balance") {
			const accountNumber = session.pending.accountNumber;
			if (!accountNumber) {
				return new Response(
					JSON.stringify({
						error: "No account number for balance operation",
					}),
					{ status: 400, headers },
				);
			}
			res = await session.client.getAccountBalanceWithTan(
				tanReference as string,
				(tan as string) || undefined,
			);
		} else if (op === "statements") {
			const accountNumber = session.pending.accountNumber;
			if (!accountNumber) {
				return new Response(
					JSON.stringify({
						error: "No account number for statements operation",
					}),
					{ status: 400, headers },
				);
			}
			res = await session.client.getAccountStatementsWithTan(
				tanReference as string,
				(tan as string) || undefined,
			);
		} else if (op === "getAllBalances") {
			// Get all balances for all accounts
			const accounts =
				session.config?.bankingInformation?.upd?.bankAccounts || [];
			const balances: Record<string, unknown> = {};

			for (const account of accounts) {
				try {
					const balanceRes = await session.client.getAccountBalanceWithTan(
						tanReference as string,
						(tan as string) || undefined,
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

			res = { success: true, data: balances };
		} else if (op === "getAllStatements") {
			// Get all statements for all accounts
			const accounts =
				session.config?.bankingInformation?.upd?.bankAccounts || [];
			const statements: Record<string, unknown> = {};

			for (const account of accounts) {
				try {
					const statementsRes =
						await session.client.getAccountStatementsWithTan(
							tanReference as string,
							(tan as string) || undefined,
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

			res = { success: true, data: statements };
		} else {
			return new Response(JSON.stringify({ error: "Invalid operation" }), {
				status: 400,
				headers,
			});
		}

		session.pending = undefined;
		return new Response(JSON.stringify(res), { headers });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		console.log(`🔍 TAN submission error analysis: ${errorMessage}`);

		// Enhanced decoupled TAN status checking
		// Look for specific FinTS response codes that indicate pending approval
		const isPendingApproval =
			errorMessage.includes("noch nicht freigegeben") || // "not yet approved"
			errorMessage.includes("Auftrag wurde noch nicht") || // "order not yet"
			errorMessage.includes("not yet approved") ||
			errorMessage.includes("pending approval") ||
			errorMessage.includes("TAN approval still pending") ||
			errorMessage.includes("3076") || // DECOUPLED_TAN_NOT_YET_APPROVED
			errorMessage.includes("3060"); // DECOUPLED_TAN_PENDING/STRONG_AUTH_REQUIRED

		// Check for explicit TAN cancellation or failure
		const isTanFailed =
			errorMessage.includes("3077") || // DECOUPLED_TAN_CANCELLED
			errorMessage.includes("3078") || // DECOUPLED_TAN_EXPIRED
			errorMessage.includes("abgebrochen") ||
			errorMessage.includes("cancelled") ||
			errorMessage.includes("expired");

		if (isPendingApproval) {
			console.log(
				"⏳ Decoupled TAN still pending approval - keeping session active for retry",
			);
			return new Response(
				JSON.stringify({
					error:
						"TAN approval still pending. Please complete the approval in your banking app and try again.",
					isPending: true,
					tanReference: tanReference, // Keep the same reference for retry
					bankAnswers: [{ code: 3076, text: "TAN approval still pending" }], // Provide status for frontend
				}),
				{ status: 202, headers }, // 202 = Accepted but processing not complete
			);
		}

		if (isTanFailed) {
			console.log("❌ Decoupled TAN failed or was cancelled");
			session.pending = undefined; // Clear pending operation
			return new Response(
				JSON.stringify({
					error: "TAN approval was cancelled or expired. Please try again.",
					bankAnswers: [
						{ code: 3077, text: "TAN approval cancelled or expired" },
					],
				}),
				{
					status: 400,
					headers,
				},
			);
		}

		// For other errors, clear the pending operation and return error
		console.log("❌ Other TAN submission error - clearing pending operation");
		session.pending = undefined;
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 400,
			headers,
		});
	}
}
