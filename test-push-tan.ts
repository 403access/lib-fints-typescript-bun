#!/usr/bin/env bun
/**
 * Quick test to verify push TAN detection functionality
 */

import { isDecoupledTanChallenge } from "./src/client/utils/fintsUtils.js";
import { createAutomaticPushTanCallback } from "./src/server/sync/sync.js";

// Test bank answers that simulate different TAN scenarios
const pushTanAnswers = [
	{ code: 3060, text: "Strong authentication required" },
	{ code: 1234, text: "Additional info" },
];

const smsTanAnswers = [
	{ code: 3920, text: "TAN required" },
	{ code: 1234, text: "Additional info" },
];

const pendingPushTanAnswers = [
	{ code: 3076, text: "Auftrag wurde noch nicht freigegeben" },
];

console.log("🧪 Testing Push TAN Detection");
console.log("=============================\n");

// Test 1: Push TAN detection
console.log("Test 1: Push TAN Detection");
console.log("- Push TAN answers:", isDecoupledTanChallenge(pushTanAnswers));
console.log("- SMS TAN answers:", isDecoupledTanChallenge(smsTanAnswers));
console.log(
	"- Pending push TAN:",
	isDecoupledTanChallenge(pendingPushTanAnswers),
);
console.log();

// Test 2: Automatic push TAN callback
console.log("Test 2: Automatic Push TAN Callback");
const automaticCallback = createAutomaticPushTanCallback((challenge, ref) => {
	console.log(`📱 Push TAN notification: ${challenge} (${ref})`);
});

try {
	const result1 = await automaticCallback(
		"Push TAN challenge",
		"ref123",
		pushTanAnswers,
	);
	console.log("✅ Push TAN handled:", result1);
} catch (error) {
	console.log("❌ Error:", error);
}

try {
	const result2 = await automaticCallback(
		"SMS TAN challenge",
		"ref456",
		smsTanAnswers,
	);
	console.log("✅ SMS TAN handled:", result2);
} catch (error) {
	console.log(
		"❌ Expected error for SMS TAN:",
		error instanceof Error ? error.message : error,
	);
}

console.log("\n✅ All tests completed!");
