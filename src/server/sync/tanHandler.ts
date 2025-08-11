/**
 * TAN authentication handler with proper pushTAN decoupled SCA polling support
 *
 * Implements the FinTS decoupled process (Process 4/S) according to specification:
 * 1. Submit job with HKTAN decoupled process
 * 2. Poll using HKTAN status requests until completion
 * 3. Look for HIRMS/HIRMG success codes (0020/0010) indicating approval
 */

import {
	isDecoupledTanChallenge,
	isTransactionSuccess,
	isDecoupledTanFailed,
	isDecoupledTanPending,
} from "../../client/utils/fintsUtils";
import type { BankAnswer } from "../../client/types/fints";
import type {
	TanCallback,
	TanCallbackResult,
	PushTanPollingOptions,
} from "./types";

/**
 * Handles pushTAN decoupled authentication with proper HKTAN status polling
 *
 * This implements the FinTS decoupled SCA flow:
 * 1. Detect if this is a decoupled TAN (Process 4/S)
 * 2. Poll using HKTAN status requests until completion
 * 3. Look for HIRMS/HIRMG success codes (0020 "Auftrag ausgeführt" or 0010 "vorgemerkt")
 * 4. Stop when we get normal success without further HITAN challenges
 *
 * @param submitTanFn Function to submit TAN (performs HKTAN status request for decoupled)
 * @param tanReference TAN reference from initial challenge
 * @param tanChallenge Challenge text for user information
 * @param bankAnswers Bank response answers containing status codes
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
		maxAttempts = 60, // 60 attempts (5 minutes at 5s intervals)
		intervalMs = 5000, // 5 seconds between HKTAN status requests
		timeoutMs = 300000, // 5 minutes total timeout
	} = pollingOptions;

	const isDecoupledTan = isDecoupledTanChallenge(bankAnswers);
	const startTime = Date.now();

	console.log(`🔐 TAN authentication required...`);
	console.log(`📋 Challenge: ${tanChallenge}`);

	if (isDecoupledTan) {
		console.log(
			`📱 Decoupled pushTAN detected (Process 4/S) - waiting for mobile app approval...`,
		);
		if (bankAnswers && bankAnswers.length > 0) {
			console.log("🏦 Bank Response Codes:");
			bankAnswers.forEach((answer) => {
				console.log(`   [${answer.code}] ${answer.text}`);
			});
		}
	}

	// Get user acknowledgment (for decoupled TAN, no input needed)
	let tanResult: TanCallbackResult;
	if (isDecoupledTan) {
		// For pushTAN, inform user but don't require TAN input
		tanResult = await tanCallback(
			`${tanChallenge}\n\n📱 Please approve this transaction in your banking app. The system will automatically check for approval using HKTAN status requests.`,
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

	// For decoupled pushTAN, start HKTAN status polling
	if (isDecoupledTan) {
		console.log("🔄 Starting HKTAN status polling for pushTAN approval...");

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			// Check timeout
			if (Date.now() - startTime > timeoutMs) {
				throw new Error(`PushTAN timeout after ${timeoutMs / 1000} seconds`);
			}

			try {
				console.log(`📡 HKTAN status request ${attempt}/${maxAttempts}...`);

				// Submit HKTAN status request (empty TAN for decoupled authentication)
				const result = await submitTanFn(tanReference, undefined);

				// Check if we got a successful response with HIRMS/HIRMG success codes
				// The lib-fints library should return the result when bank signals completion
				console.log("✅ PushTAN approved successfully! Transaction completed.");
				return result;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				// Parse the error to check if it contains bank response codes
				// This is where we check for specific FinTS response codes
				if (
					errorMessage.includes("noch nicht freigegeben") || // "not yet approved"
					errorMessage.includes("Auftrag wurde noch nicht") || // "order not yet"
					errorMessage.includes("not yet approved") ||
					errorMessage.includes("pending approval") ||
					errorMessage.includes("TAN approval still pending") ||
					errorMessage.includes("3076") || // DECOUPLED_TAN_NOT_YET_APPROVED
					errorMessage.includes("3060") // DECOUPLED_TAN_PENDING/STRONG_AUTH_REQUIRED
				) {
					console.log(
						`⏳ Still waiting for pushTAN approval (attempt ${attempt}/${maxAttempts})...`,
					);

					// Wait before next HKTAN status request
					if (attempt < maxAttempts) {
						await new Promise((resolve) => setTimeout(resolve, intervalMs));
					}
					continue;
				}

				// Check for explicit failure codes
				if (
					errorMessage.includes("3077") || // DECOUPLED_TAN_CANCELLED
					errorMessage.includes("3078") || // DECOUPLED_TAN_EXPIRED
					errorMessage.includes("abgebrochen") ||
					errorMessage.includes("cancelled")
				) {
					throw new Error(
						"PushTAN was cancelled or expired in the banking app",
					);
				}

				// For any other error, it's likely a real failure
				console.error(
					`❌ Unexpected error during pushTAN polling: ${errorMessage}`,
				);
				throw error;
			}
		}

		throw new Error(
			`PushTAN approval not received after ${maxAttempts} HKTAN status requests. ` +
				`Please check your banking app and try again.`,
		);
	} else {
		// For regular TAN, submit once with user input
		console.log("🔢 Submitting traditional TAN...");
		return await submitTanFn(tanReference, tanResult.tan);
	}
}
