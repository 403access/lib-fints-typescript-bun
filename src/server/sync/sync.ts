/**
 * Server-side entry point to retrieve all statements from a given account
 *
 * This module provides a programmatic interface to fetch bank statements
 * without going through the HTTP API. Useful for server-side batch processing,
 * scheduled tasks, or integrations with other services.
 *
 * Supports TAN authentication with callback-based interaction.
 */

import { FinTSClient, FinTSConfig } from "lib-fints";
import type { BankAnswer } from "../../client/types/fints";
import { handlePushTanWithPolling } from "./tanHandler";
import type {
	SyncCredentials,
	AccountStatementsOptions,
	TanCallback,
	SyncResult,
	StatementResponse,
} from "./types";

/**
 * Synchronously retrieve all statements from banking accounts with TAN support
 *
 * @param credentials Banking credentials
 * @param options Optional parameters for filtering accounts/dates
 * @param tanCallback Optional callback for TAN authentication (if required)
 * @returns Promise resolving to statements data or error
 */
export async function syncAllStatements(
	credentials: SyncCredentials,
	options: AccountStatementsOptions = {},
	tanCallback?: TanCallback,
): Promise<SyncResult> {
	let client: FinTSClient | null = null;

	try {
		// Create FinTS configuration
		const config = FinTSConfig.forFirstTimeUse(
			credentials.productId,
			credentials.productVersion,
			credentials.bankUrl,
			credentials.bankId,
			credentials.userId,
			credentials.pin,
		);
		console.log("FinTS configuration created:", config);

		// Initialize client
		client = new FinTSClient(config);

		// Perform initial synchronization with TAN handling
		const syncRes = await client.synchronize();
		console.log("Initial synchronization result:", syncRes);

		// Check for PIN blocking or other critical errors
		if (syncRes.bankAnswers) {
			const isPinBlocked = syncRes.bankAnswers.some(
				(answer) =>
					answer.code === 3938 || // PIN blocked
					answer.code === 9900, // Login failed
			);

			if (isPinBlocked) {
				const blockMessage =
					syncRes.bankAnswers.find(
						(answer) => answer.code === 3938 || answer.code === 9900,
					)?.text || "PIN is blocked or login failed";

				return {
					success: false,
					error: `Authentication failed: ${blockMessage}. Please unblock your PIN through your bank's website or app.`,
					bankingInformation: config.bankingInformation,
				};
			}
		}

		// Select TAN method if available (but don't sync again)
		if (
			syncRes.success &&
			config.bankingInformation?.bpd?.availableTanMethodIds?.includes(923)
		) {
			const res = await client.selectTanMethod(923);
			console.log("Selected TAN method:", res);
		}

		// After initial sync and TAN method selection, perform a second sync to get account information (UPD)
		// This is often required in FinTS to retrieve user-specific data like accounts
		let finalSyncRes = syncRes;
		if (syncRes.success && !syncRes.requiresTan) {
			try {
				console.log(
					"Performing second sync to retrieve account information...",
				);
				finalSyncRes = await client.synchronize();
				console.log("Final synchronization result:", finalSyncRes);
			} catch (error) {
				console.warn(
					"Second sync failed, proceeding with first sync result:",
					error,
				);
				// Continue with first sync result
			}
		}

		if (finalSyncRes.requiresTan) {
			if (!tanCallback) {
				return {
					success: false,
					error:
						"TAN authentication required but no TAN callback provided. Please provide a tanCallback function to handle TAN authentication.",
					bankingInformation: config.bankingInformation,
				};
			}

			// Validate TAN reference
			if (!finalSyncRes.tanReference) {
				console.warn(
					"Warning: TAN required but no TAN reference provided by bank",
				);
				return {
					success: false,
					error:
						"TAN authentication required but bank provided no TAN reference",
					bankingInformation: config.bankingInformation,
				};
			}

			try {
				// Handle push TAN with polling or regular TAN
				// At this point client is guaranteed to be non-null since we just created it
				const fintsClient = client;
				await handlePushTanWithPolling(
					(reference: string, tan?: string) =>
						fintsClient.synchronizeWithTan(reference, tan),
					finalSyncRes.tanReference,
					finalSyncRes.tanChallenge || "TAN required for synchronization",
					finalSyncRes.bankAnswers,
					tanCallback,
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					success: false,
					error: `TAN authentication failed: ${errorMessage}`,
					bankingInformation: config.bankingInformation,
				};
			}
		}

		// Get account information
		const bankingInfo = config.bankingInformation;
		const accounts = bankingInfo?.upd?.bankAccounts || [];

		if (accounts.length === 0) {
			return {
				success: false,
				error: "No accounts found after synchronization",
				bankingInformation: bankingInfo,
			};
		}

		// Determine which accounts to process
		let targetAccounts = accounts;
		if (options.accountNumber) {
			targetAccounts = accounts.filter(
				(acc) =>
					acc.accountNumber === options.accountNumber ||
					acc.iban === options.accountNumber,
			);

			if (targetAccounts.length === 0) {
				return {
					success: false,
					error: `Account ${options.accountNumber} not found`,
					bankingInformation: bankingInfo,
				};
			}
		}

		// Retrieve statements for each account with TAN handling
		const statements: Record<string, unknown> = {};
		const errors: string[] = [];

		for (const account of targetAccounts) {
			try {
				console.log(
					`Retrieving statements for account ${account.accountNumber}...`,
				);

				const statementsRes = await client.getAccountStatements(
					account.accountNumber,
					options.startDate,
					options.endDate,
				);

				if (statementsRes.requiresTan) {
					if (!tanCallback) {
						errors.push(
							`TAN required for account ${account.accountNumber} but no callback provided`,
						);
						continue;
					}

					try {
						console.log(
							`TAN authentication required for account ${account.accountNumber}...`,
						);

						// Handle push TAN with polling or regular TAN for statements
						const fintsClient = client;
						const tanSubmitRes = await handlePushTanWithPolling(
							(reference: string, tan?: string) =>
								fintsClient.getAccountStatementsWithTan(reference, tan),
							statementsRes.tanReference || "",
							statementsRes.tanChallenge ||
								`TAN required for account ${account.accountNumber}`,
							statementsRes.bankAnswers,
							tanCallback,
						);

						if (
							tanSubmitRes &&
							typeof tanSubmitRes === "object" &&
							"success" in tanSubmitRes &&
							tanSubmitRes.success &&
							"statements" in tanSubmitRes
						) {
							statements[account.accountNumber] = (
								tanSubmitRes as StatementResponse
							).statements;
						} else {
							const bankAnswers =
								tanSubmitRes &&
								typeof tanSubmitRes === "object" &&
								"bankAnswers" in tanSubmitRes
									? (tanSubmitRes as StatementResponse).bankAnswers
									: undefined;
							errors.push(
								`Failed to retrieve statements for account ${account.accountNumber}: ${bankAnswers?.map((b: BankAnswer) => b.text).join("; ") || "Unknown error"}`,
							);
						}
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						if (errorMessage.includes("cancelled")) {
							errors.push(
								`TAN authentication cancelled for account ${account.accountNumber}`,
							);
						} else {
							errors.push(
								`TAN authentication failed for account ${account.accountNumber}: ${errorMessage}`,
							);
						}
					}
				} else if (statementsRes.success && statementsRes.statements) {
					statements[account.accountNumber] = statementsRes.statements;
				} else {
					errors.push(
						`Failed to retrieve statements for account ${account.accountNumber}`,
					);
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				errors.push(`Error for account ${account.accountNumber}: ${errorMsg}`);
			}
		}

		// Return results
		if (Object.keys(statements).length === 0) {
			return {
				success: false,
				error:
					errors.length > 0 ? errors.join("; ") : "No statements retrieved",
				bankingInformation: bankingInfo,
			};
		}

		return {
			success: true,
			data: {
				statements,
				accounts: targetAccounts.map((acc) => ({
					accountNumber: acc.accountNumber,
					iban: acc.iban,
					currency: acc.currency,
				})),
			},
			bankingInformation: bankingInfo,
			...(errors.length > 0 && {
				error: `Partial success. Errors: ${errors.join("; ")}`,
			}),
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			error: `Sync failed: ${errorMessage}`,
		};
	} finally {
		// Clean up client connection if needed
		if (client) {
			// The lib-fints client should handle cleanup automatically
			// but we can add explicit cleanup here if needed in the future
		}
	}
}

/**
 * Retrieve statements for a specific account with TAN support
 *
 * @param credentials Banking credentials
 * @param accountNumber Account number or IBAN
 * @param options Optional date filtering
 * @param tanCallback Optional callback for TAN authentication
 * @returns Promise resolving to statements data or error
 */
export async function syncAccountStatements(
	credentials: SyncCredentials,
	accountNumber: string,
	options: { startDate?: Date; endDate?: Date } = {},
	tanCallback?: TanCallback,
): Promise<SyncResult> {
	return syncAllStatements(
		credentials,
		{
			accountNumber,
			...options,
		},
		tanCallback,
	);
}

// Re-export from other modules for convenience
export { validateCredentials } from "./validation";
export {
	createCommandLineTanCallback,
	createAutomaticPushTanCallback,
} from "./tanCallbacks";
export { handlePushTanWithPolling } from "./tanHandler";

// Re-export types
export type * from "./types";
