/**
 * TAN authentication handler with push TAN polling support
 */

import { isDecoupledTanChallenge } from "../../client/utils/fintsUtils.js";
import type { BankAnswer } from "../../client/types/fints.js";
import type {
	TanCallback,
	TanCallbackResult,
	PushTanPollingOptions,
} from "../types.js";

/**
 * Handles push TAN authentication with polling for user approval
 *
 * @param submitTanFn Function to submit TAN (different for sync vs statements)
 * @param tanReference TAN reference from initial challenge
 * @param tanChallenge Challenge text for user information
 * @param bankAnswers Bank response answers
 * @param tanCallback User's TAN callback function
 * @param pollingOptions Configuration for polling behavior
 * @returns Promise resolving to the operation result
 */
export async function handlePushTanWithPolling<T>(
	submitTanFn: (reference: string, tan?: string) => Promise<T>,
	tanReference: string,
	tanChallenge: string,
	bankAnswers: BankAnswer[] | undefined,
	tanCallback: TanCallback,
	pollingOptions: PushTanPollingOptions = {},
): Promise<T> {
	const {
		maxAttempts = 60, // 60 attempts
		intervalMs = 5000, // 5 seconds between attempts
		timeoutMs = 300000, // 5 minutes total timeout
	} = pollingOptions;

	const isDecoupledTan = isDecoupledTanChallenge(bankAnswers);
	const startTime = Date.now();

	console.log(`🔐 TAN authentication required...`);
	console.log(`📋 Challenge: ${tanChallenge}`);

	if (isDecoupledTan) {
		console.log(`📱 Push TAN detected - waiting for mobile app approval...`);
		if (bankAnswers && bankAnswers.length > 0) {
			console.log("🏦 Bank Messages:");
			bankAnswers.forEach((answer) => {
				console.log(`   [${answer.code}] ${answer.text}`);
			});
		}
	}

	// For push TAN, we don't need user input - just wait for approval
	let tanResult: TanCallbackResult;
	if (isDecoupledTan) {
		// For push TAN, inform user but don't require input
		tanResult = await tanCallback(
			`${tanChallenge}\n\n📱 Please approve this transaction in your banking app. No TAN input required - just approve and we'll continue automatically.`,
			tanReference,
			bankAnswers,
		);
	} else {
		// For regular TAN, get user input
		tanResult = await tanCallback(tanChallenge, tanReference, bankAnswers);
	}

	if (tanResult.cancel) {
		throw new Error("TAN authentication cancelled by user");
	}

	// For push TAN, start polling
	if (isDecoupledTan) {
		console.log("🔄 Starting push TAN polling...");

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			// Check timeout
			if (Date.now() - startTime > timeoutMs) {
				throw new Error(`Push TAN timeout after ${timeoutMs / 1000} seconds`);
			}

			try {
				console.log(`📡 Polling attempt ${attempt}/${maxAttempts}...`);

				// Submit empty TAN for push authentication
				const result = await submitTanFn(tanReference, undefined);

				console.log("✅ Push TAN approved successfully!");
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				// Check if still pending approval
				if (
					errorMessage.includes("noch nicht freigegeben") ||
					errorMessage.includes("Auftrag wurde noch nicht") ||
					errorMessage.includes("not yet approved") ||
					errorMessage.includes("pending approval") ||
					errorMessage.includes("TAN approval still pending")
				) {
					console.log(
						`⏳ Still waiting for approval (attempt ${attempt}/${maxAttempts})...`,
					);

					// Wait before next attempt
					if (attempt < maxAttempts) {
						await new Promise((resolve) => setTimeout(resolve, intervalMs));
					}
					continue;
				}

				// If it's a different error, throw it
				throw error;
			}
		}

		throw new Error(
			`Push TAN approval not received after ${maxAttempts} attempts`,
		);
	} else {
		// For regular TAN, submit once
		return await submitTanFn(tanReference, tanResult.tan);
	}
}
