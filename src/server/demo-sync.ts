#!/usr/bin/env bun
/**
 * Demo script showing how to use the enhanced sync functionality with TAN support
 */

import {
	syncAllStatements,
	createCommandLineTanCallback,
	validateCredentials,
	type SyncCredentials,
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

async function demonstrateSync() {
	console.log("🚀 Starting FinTS Sync Demonstration");
	console.log("=====================================\n");

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

	// Create TAN callback for interactive authentication
	const tanCallback = createCommandLineTanCallback();

	try {
		console.log("📊 Attempting to sync all account statements...");
		console.log("⏳ This may require TAN authentication...\n");

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
			console.log("\n✅ SUCCESS: Statements retrieved successfully!");
			console.log("==========================================");

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
		} else {
			console.log("\n❌ FAILED: Could not retrieve statements");
			console.log("=========================================");
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

			console.log(
				"\n💡 Some accounts might not support statement retrieval or require different authentication.",
			);
			console.log(
				"   This is normal - not all account types support all operations.",
			);
		}
	} catch (error) {
		console.error("\n💥 EXCEPTION: An unexpected error occurred");
		console.error("==========================================");
		console.error(error);
	}

	console.log("\n🎯 Demo completed");
}

// Run the demonstration if this script is executed directly
if (import.meta.main) {
	demonstrateSync().catch(console.error);
}

export { demonstrateSync };
