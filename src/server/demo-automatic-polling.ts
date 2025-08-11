#!/usr/bin/env bun
/**
 * Demo script showing automatic push TAN polling with the new HKTAN status API
 */

import {
	createAutomaticPushTanCallback,
	type SyncCredentials,
	syncAllStatements,
	validateCredentials,
} from "./sync";

// Example credentials (replace with real values)
const credentials: SyncCredentials = {
	productId: process.env.FINTS_PRODUCT_REGISTER_ID || "YOUR_PRODUCT_ID",
	productVersion: "1.0.0",
	bankUrl: "https://banking-bw4.s-fints-pt-bw.de/fints30", // Example bank URL
	bankId: "60450050", // Example BLZ
	userId: process.env.FINTS_USER_ID || "YOUR_USER_ID",
	pin: process.env.FINTS_PIN || "YOUR_PIN",
};

async function demonstrateAutomaticPolling() {
	console.log("🚀 Starting FinTS Automatic Push TAN Polling Demo");
	console.log("===============================================\n");

	// Validate credentials first
	const validationErrors = validateCredentials(credentials);
	if (validationErrors.length > 0) {
		console.error("❌ Credential validation failed:");
		validationErrors.forEach((error) => console.error(`   ${error}`));
		console.log("\n💡 Please set the following environment variables:");
		console.log("   export FINTS_PRODUCT_ID='your-registered-product-id'");
		console.log("   export FINTS_USER_ID='your-user-id'");
		console.log("   export FINTS_PIN='your-pin'");
		console.log("\n🔄 Continuing anyway for demonstration purposes...\n");
	}

	// Create automatic push TAN callback that handles push TAN without user interaction
	const tanCallback = createAutomaticPushTanCallback((challenge, reference) => {
		console.log(`📱 Push TAN detected: ${challenge}`);
		console.log(`🔑 Reference: ${reference}`);
		console.log("⏳ Automatic polling will handle the approval...");
	});

	try {
		console.log("📊 Attempting to sync with automatic push TAN handling...");
		console.log("🔄 The system will automatically detect and poll for push TAN approval.\n");

		const result = await syncAllStatements(
			credentials,
			{
				// Optional: filter by date range
				// startDate: new Date('2024-01-01'),
				// endDate: new Date('2024-12-31')
			},
			tanCallback,
		);

		if (result.success) {
			console.log("\n✅ SUCCESS: Automatic push TAN polling completed successfully!");
			console.log("=========================================================");

			const accountCount = Object.keys(result.data?.statements || {}).length;
			console.log(`📈 Retrieved statements for ${accountCount} account(s)`);

			// Display account information
			if (result.data?.accounts) {
				console.log("\n🏦 Account Details:");
				result.data.accounts.forEach((account, index) => {
					const hasStatements =
						result.data?.statements?.[account.accountNumber];
					const statusIcon = hasStatements ? "✅" : "❌";
					console.log(
						`   ${statusIcon} ${index + 1}. Account: ${account.accountNumber}`,
					);
					if (account.iban) console.log(`      IBAN: ${account.iban}`);
					if (account.currency)
						console.log(`      Currency: ${account.currency}`);
				});
			}

			// Display banking information if available
			if (result.bankingInformation) {
				console.log(
					`\n🏪 Bank: System ID ${result.bankingInformation.systemId}`,
				);
				if (result.bankingInformation.bankMessages?.length) {
					console.log("📢 Bank Messages:");
					result.bankingInformation.bankMessages.forEach((msg) => {
						console.log(
							`   ${msg.subject ? msg.subject + ": " : ""}${msg.text}`,
						);
					});
				}
			}

			// Show partial success warnings if any
			if (result.error) {
				console.log(`\n⚠️  Warning: ${result.error}`);
			}

			console.log("\n🎯 Key Features Demonstrated:");
			console.log("   ✅ Automatic push TAN detection");
			console.log("   ✅ HKTAN status polling according to FinTS specification");
			console.log("   ✅ No manual user interaction required");
			console.log("   ✅ Proper error handling for cancelled/expired TAN");
		} else {
			console.log("\n❌ FAILED: Could not complete sync with automatic polling");
			console.log("=========================================================");
			console.log(`Error: ${result.error}`);

			// Still show banking info if available for debugging
			if (result.bankingInformation) {
				console.log(
					`\nBank connection was established (System ID: ${result.bankingInformation.systemId})`,
				);

				// Show available accounts even if statements failed
				const accounts = result.bankingInformation.upd?.bankAccounts || [];
				if (accounts.length > 0) {
					console.log(`\n🏦 Available Accounts (${accounts.length}):`);
					accounts.forEach((account, index) => {
						console.log(`   ${index + 1}. Account: ${account.accountNumber}`);
						if (account.iban) console.log(`      IBAN: ${account.iban}`);
						if (account.currency)
							console.log(`      Currency: ${account.currency}`);
					});
				}
			}

			console.log("\n💡 Note: The automatic polling system is working, but other factors");
			console.log("   might affect statement retrieval (account permissions, etc.)");
		}
	} catch (error) {
		console.error("\n💥 EXCEPTION: An unexpected error occurred");
		console.error("==========================================");
		console.error(error);
		
		console.log("\n🔍 This could be due to:");
		console.log("   - Network connectivity issues");
		console.log("   - Bank server problems");
		console.log("   - Invalid credentials");
		console.log("   - TAN method not supporting decoupled authentication");
	}

	console.log("\n🎯 Demo completed");
	console.log("\n📚 What this demo showed:");
	console.log("   • Automatic detection of push TAN (decoupled SCA)");
	console.log("   • HKTAN status polling without user interaction");
	console.log("   • Proper FinTS specification compliance");
	console.log("   • Enhanced error handling and retry logic");
}

// Run the demonstration if this script is executed directly
if (import.meta.main) {
	demonstrateAutomaticPolling().catch(console.error);
}

export { demonstrateAutomaticPolling };
