import type { Session } from "../types";
import { 
	isDecoupledTanPending, 
	isTransactionSuccess, 
	isDecoupledTanFailed 
} from "../../../client/utils/fintsUtils";

export interface PollTanStatusRequest {
	tanReference: string;
	operation: string;
	accountNumber?: string;
	maxAttempts?: number;
	intervalMs?: number;
}

export interface PollTanStatusResponse {
	success: boolean;
	data?: unknown;
	error?: string;
	isPending?: boolean;
	bankAnswers?: Array<{ code: number; text: string }>;
}

/**
 * Polls the bank using HKTAN status requests for decoupled TAN (pushTAN) approval
 * This implements the proper FinTS decoupled SCA flow according to specification
 */
export async function handlePollTanStatus(
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

	const { 
		tanReference, 
		operation, 
		accountNumber, 
		maxAttempts = 60, 
		intervalMs = 5000 
	} = payload as unknown as PollTanStatusRequest;

	if (!tanReference || !operation) {
		return new Response(
			JSON.stringify({ 
				error: "tanReference and operation are required" 
			}), 
			{ status: 400, headers }
		);
	}

	// Verify we have a pending operation that matches
	if (!session.pending || session.pending.op !== operation) {
		return new Response(
			JSON.stringify({ 
				error: "No matching pending operation for TAN polling" 
			}), 
			{ status: 400, headers }
		);
	}

	try {
		console.log(`🔄 Starting HKTAN status polling for operation: ${operation}`);
		console.log(`📡 TAN Reference: ${tanReference}`);

		// Perform the polling loop
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			console.log(`📡 HKTAN status request ${attempt}/${maxAttempts}...`);

			try {
				let result: unknown;

				// Submit HKTAN status request based on operation type
				// For decoupled TAN, we use empty/undefined TAN to poll status
				// Note: lib-fints throws exceptions when TAN is still pending
				switch (operation) {
					case "sync":
						result = await session.client.synchronizeWithTan(
							tanReference,
							undefined // Empty TAN for status polling
						);
						break;

					case "balance":
						if (!accountNumber) {
							throw new Error("Account number required for balance operation");
						}
						result = await session.client.getAccountBalanceWithTan(
							tanReference,
							undefined // Empty TAN for status polling
						);
						break;

					case "statements":
						if (!accountNumber) {
							throw new Error("Account number required for statements operation");
						}
						result = await session.client.getAccountStatementsWithTan(
							tanReference,
							undefined // Empty TAN for status polling
						);
						break;

					case "getAllBalances": {
						// For getAllBalances, we need to handle multiple accounts
						// Start with the first account for TAN approval
						const accounts = session.config?.bankingInformation?.upd?.bankAccounts || [];
						if (accounts.length === 0) {
							throw new Error("No accounts available for balance operation");
						}

						result = await session.client.getAccountBalanceWithTan(
							tanReference,
							undefined // Empty TAN for status polling
						);
						break;
					}

					case "getAllStatements": {
						// Similar to getAllBalances, start with first account
						const stmtAccounts = session.config?.bankingInformation?.upd?.bankAccounts || [];
						if (stmtAccounts.length === 0) {
							throw new Error("No accounts available for statements operation");
						}

						result = await session.client.getAccountStatementsWithTan(
							tanReference,
							undefined // Empty TAN for status polling
						);
						break;
					}

					default:
						throw new Error(`Unknown operation: ${operation}`);
				}

				// If we get here without exception, the TAN was approved and operation completed
				console.log("✅ PushTAN approved successfully! Transaction completed.");
				
				// Clear pending operation and return success
				session.pending = undefined;
				
				// For sync operations, add banking information to the response
				if (operation === "sync" && result && typeof result === "object" && "success" in result && result.success) {
					const bankingInformation = session.config?.bankingInformation;
					if (bankingInformation) {
						(result as Record<string, unknown>).data = { bankingInformation };
					}
				}
				
				return new Response(JSON.stringify(result), { headers });

			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.log(`🔍 HKTAN polling error: ${errorMessage}`);

				// Parse error message for FinTS status codes
				const isPendingApproval =
					errorMessage.includes("noch nicht freigegeben") || // "not yet approved"
					errorMessage.includes("Auftrag wurde noch nicht") || // "order not yet"
					errorMessage.includes("not yet approved") ||
					errorMessage.includes("pending approval") ||
					errorMessage.includes("TAN approval still pending") ||
					errorMessage.includes("3076") || // DECOUPLED_TAN_NOT_YET_APPROVED
					errorMessage.includes("3060"); // DECOUPLED_TAN_PENDING

				const isTanFailed =
					errorMessage.includes("3077") || // DECOUPLED_TAN_CANCELLED
					errorMessage.includes("3078") || // DECOUPLED_TAN_EXPIRED
					errorMessage.includes("abgebrochen") ||
					errorMessage.includes("cancelled") ||
					errorMessage.includes("expired");

				if (isPendingApproval) {
					console.log(`⏳ Still waiting for pushTAN approval (attempt ${attempt}/${maxAttempts})...`);
					
					// Wait before next poll if not the last attempt
					if (attempt < maxAttempts) {
						await new Promise(resolve => setTimeout(resolve, intervalMs));
					}
					continue;
				}

				if (isTanFailed) {
					console.log("❌ PushTAN failed or was cancelled");
					session.pending = undefined;
					return new Response(
						JSON.stringify({
							success: false,
							error: "TAN approval was cancelled or expired",
							bankAnswers: [{ code: 3077, text: "TAN approval cancelled or expired" }]
						}),
						{ status: 400, headers }
					);
				}

				// For any other error, it's likely a real failure
				console.error(`❌ Unexpected error during pushTAN polling: ${errorMessage}`);
				session.pending = undefined;
				return new Response(
					JSON.stringify({
						success: false,
						error: `TAN polling failed: ${errorMessage}`
					}),
					{ status: 400, headers }
				);
			}
		}

		// If we've exhausted all attempts
		console.log(`❌ PushTAN approval timeout after ${maxAttempts} attempts`);
		
		return new Response(
			JSON.stringify({
				success: false,
				error: `PushTAN approval not received after ${maxAttempts} status requests. Please check your banking app and try again.`,
				isPending: true,
				bankAnswers: [{ code: 3076, text: "TAN approval timeout" }]
			}),
			{ status: 408, headers } // 408 Request Timeout
		);

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("❌ Error in TAN status polling:", errorMessage);
		
		return new Response(
			JSON.stringify({
				success: false,
				error: `TAN status polling failed: ${errorMessage}`
			}),
			{ status: 500, headers }
		);
	}
}
