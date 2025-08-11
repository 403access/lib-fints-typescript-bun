/**
 * Pre-built TAN callback implementations for different use cases
 */

import { isDecoupledTanChallenge } from "../../client/utils/fintsUtils";
import type { BankAnswer } from "../../client/types/fints";
import type { TanCallback, TanCallbackResult } from "../types";

/**
 * Creates a simple command-line TAN callback for interactive authentication
 * Requires Node.js readline module
 *
 * @returns TAN callback function for command-line interaction
 */
export function createCommandLineTanCallback(): TanCallback {
	return async (
		tanChallenge: string,
		tanReference: string,
		bankAnswers?: BankAnswer[],
	): Promise<TanCallbackResult> => {
		// Dynamic import to avoid issues in non-Node environments
		const { createInterface } = await import("readline");

		console.log("\n🔐 === TAN Authentication Required ===");
		console.log("📋 Challenge:", tanChallenge);
		console.log("🔑 Reference:", tanReference);

		if (bankAnswers && bankAnswers.length > 0) {
			console.log("🏦 Bank Messages:");
			bankAnswers.forEach((answer) => {
				console.log(`   [${answer.code}] ${answer.text}`);
			});
		}

		// Check if this is a push TAN (decoupled authentication)
		const isDecoupledTan = isDecoupledTanChallenge(bankAnswers);

		if (isDecoupledTan) {
			console.log(
				"\n📱 This appears to be a push TAN (mobile app authentication).",
			);
			console.log("📋 Please approve the transaction in your banking app.");
			console.log("⏳ The system will automatically check for approval...");

			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			return new Promise((resolve) => {
				rl.question(
					'🔄 Press Enter when you have approved in your app (or type "cancel" to abort): ',
					(answer) => {
						rl.close();
						const input = answer.trim();

						if (
							input.toLowerCase() === "cancel" ||
							input.toLowerCase() === "c"
						) {
							console.log("❌ TAN authentication cancelled by user");
							resolve({ tan: "", cancel: true });
						} else {
							console.log("✅ Proceeding with push TAN authentication...");
							resolve({ tan: "" }); // Empty TAN for push authentication
						}
					},
				);
			});
		} else {
			// Regular TAN input
			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			return new Promise((resolve) => {
				rl.question('🔢 Enter TAN (or "cancel" to abort): ', (answer) => {
					rl.close();
					const input = answer.trim();

					if (input.toLowerCase() === "cancel" || input.toLowerCase() === "c") {
						console.log("❌ TAN authentication cancelled by user");
						resolve({ tan: "", cancel: true });
					} else if (input.length === 0) {
						console.log("❌ Empty TAN provided, treating as cancel");
						resolve({ tan: "", cancel: true });
					} else {
						console.log("✅ TAN submitted, processing...");
						resolve({ tan: input });
					}
				});
			});
		}
	};
}

/**
 * Creates a push TAN callback that automatically handles polling without user interaction
 * Useful for headless/automated scenarios where push TAN is expected
 *
 * @param onPushTanDetected Optional callback to notify when push TAN is detected
 * @returns TAN callback function for automated push TAN handling
 */
export function createAutomaticPushTanCallback(
	onPushTanDetected?: (challenge: string, reference: string) => void,
): TanCallback {
	return async (
		tanChallenge: string,
		tanReference: string,
		bankAnswers?: BankAnswer[],
	): Promise<TanCallbackResult> => {
		const isDecoupledTan = isDecoupledTanChallenge(bankAnswers);

		if (isDecoupledTan) {
			console.log(`📱 Push TAN detected: ${tanChallenge}`);
			if (onPushTanDetected) {
				onPushTanDetected(tanChallenge, tanReference);
			}
			// Return empty TAN for automatic push handling
			return { tan: "" };
		} else {
			// For regular TAN, we can't handle automatically
			throw new Error(
				`Manual TAN input required but automatic callback provided. Challenge: ${tanChallenge}`,
			);
		}
	};
}
