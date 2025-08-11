/**
 * Dependency Injection TAN Authentication Pattern
 *
 * Pros:
 * - Clear interface contracts
 * - Easy to swap implementations
 * - Excellent for testing (mock injection)
 * - Framework-agnostic
 * - Supports multiple authentication strategies
 *
 * Cons:
 * - Requires DI container setup
 * - More initial complexity
 * - Can be overkill for simple apps
 */

import type { BankAnswer } from "../../client/types/fints.js";

// Interface for TAN authentication strategy
interface ITanAuthenticator {
	authenticate(
		challenge: string,
		reference: string,
		bankAnswers?: BankAnswer[],
	): Promise<string>;
	canHandle(challenge: string): boolean;
	getName(): string;
}

// Different authentication implementations
class SmsTanAuthenticator implements ITanAuthenticator {
	constructor(private phoneNumber: string) {}

	canHandle(challenge: string): boolean {
		return (
			challenge.toLowerCase().includes("sms") ||
			challenge.toLowerCase().includes("text")
		);
	}

	getName(): string {
		return "SMS TAN";
	}

	async authenticate(challenge: string, reference: string): Promise<string> {
		console.log(
			`📱 SMS TAN sent to ${this.phoneNumber.replace(/\d(?=\d{3})/g, "*")}`,
		);
		console.log(`Challenge: ${challenge}`);

		// Simulate SMS delay
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// In real implementation: integrate with SMS provider
		return "123456"; // Simulated TAN
	}
}

class AppTanAuthenticator implements ITanAuthenticator {
	constructor(private appName: string) {}

	canHandle(challenge: string): boolean {
		return (
			challenge.toLowerCase().includes("app") ||
			challenge.toLowerCase().includes("push")
		);
	}

	getName(): string {
		return `${this.appName} App TAN`;
	}

	async authenticate(challenge: string, reference: string): Promise<string> {
		console.log(`📱 Push notification sent to ${this.appName}`);
		console.log(`Challenge: ${challenge}`);

		// Simulate app interaction
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// In real implementation: communicate with mobile app
		return "654321"; // Simulated app TAN
	}
}

class HardwareTokenAuthenticator implements ITanAuthenticator {
	constructor(private tokenSerial: string) {}

	canHandle(challenge: string): boolean {
		return (
			challenge.toLowerCase().includes("token") ||
			challenge.toLowerCase().includes("hardware")
		);
	}

	getName(): string {
		return `Hardware Token (${this.tokenSerial})`;
	}

	async authenticate(challenge: string, reference: string): Promise<string> {
		console.log(`🔐 Hardware token required (Serial: ${this.tokenSerial})`);
		console.log(`Challenge: ${challenge}`);

		// Simulate manual token input
		const { createInterface } = await import("readline");
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		return new Promise((resolve) => {
			rl.question("Enter TAN from hardware token: ", (answer) => {
				rl.close();
				resolve(answer.trim());
			});
		});
	}
}

// TAN authentication manager with dependency injection
class TanAuthenticationManager {
	private authenticators: ITanAuthenticator[] = [];
	private defaultAuthenticator?: ITanAuthenticator;

	register(authenticator: ITanAuthenticator): void {
		this.authenticators.push(authenticator);
	}

	setDefault(authenticator: ITanAuthenticator): void {
		this.defaultAuthenticator = authenticator;
		if (!this.authenticators.includes(authenticator)) {
			this.register(authenticator);
		}
	}

	async authenticate(
		challenge: string,
		reference: string,
		bankAnswers?: BankAnswer[],
	): Promise<string> {
		// Find appropriate authenticator
		let authenticator = this.authenticators.find((auth) =>
			auth.canHandle(challenge),
		);

		if (!authenticator && this.defaultAuthenticator) {
			authenticator = this.defaultAuthenticator;
		}

		if (!authenticator) {
			throw new Error(
				`No TAN authenticator available for challenge: ${challenge}`,
			);
		}

		console.log(`🔐 Using ${authenticator.getName()} for authentication`);

		try {
			const tan = await authenticator.authenticate(
				challenge,
				reference,
				bankAnswers,
			);
			console.log(
				`✅ TAN authentication successful with ${authenticator.getName()}`,
			);
			return tan;
		} catch (error) {
			console.error(
				`❌ TAN authentication failed with ${authenticator.getName()}:`,
				error,
			);
			throw error;
		}
	}

	getAvailableAuthenticators(): string[] {
		return this.authenticators.map((auth) => auth.getName());
	}
}

// Dependency injection setup
export function createTanManager(userPreferences: {
	phoneNumber?: string;
	appName?: string;
	tokenSerial?: string;
	preferredMethod?: "sms" | "app" | "token";
}): TanAuthenticationManager {
	const manager = new TanAuthenticationManager();

	// Register available authenticators based on user setup
	if (userPreferences.phoneNumber) {
		const smsAuth = new SmsTanAuthenticator(userPreferences.phoneNumber);
		manager.register(smsAuth);

		if (userPreferences.preferredMethod === "sms") {
			manager.setDefault(smsAuth);
		}
	}

	if (userPreferences.appName) {
		const appAuth = new AppTanAuthenticator(userPreferences.appName);
		manager.register(appAuth);

		if (userPreferences.preferredMethod === "app") {
			manager.setDefault(appAuth);
		}
	}

	if (userPreferences.tokenSerial) {
		const tokenAuth = new HardwareTokenAuthenticator(
			userPreferences.tokenSerial,
		);
		manager.register(tokenAuth);

		if (userPreferences.preferredMethod === "token") {
			manager.setDefault(tokenAuth);
		}
	}

	return manager;
}

// Usage in sync function
export async function syncWithDependencyInjection(
	credentials: any,
	tanManager: TanAuthenticationManager,
) {
	console.log(
		"Available TAN methods:",
		tanManager.getAvailableAuthenticators(),
	);

	try {
		// Simulate TAN requirement
		const tan = await tanManager.authenticate(
			"SMS TAN required for account access",
			"ref123",
		);

		console.log("Banking operation successful with TAN:", tan);
	} catch (error) {
		console.error("Banking operation failed:", error);
	}
}

// Example setup
export function exampleDependencyInjection() {
	// Configure TAN manager based on user preferences
	const tanManager = createTanManager({
		phoneNumber: "+49123456789",
		appName: "MyBank App",
		tokenSerial: "HW-12345",
		preferredMethod: "app",
	});

	// Use in banking operations
	syncWithDependencyInjection({}, tanManager);
}
