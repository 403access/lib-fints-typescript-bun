/**
 * State Machine TAN Authentication Pattern
 *
 * Pros:
 * - Clear state transitions and validation
 * - Easy to visualize authentication flow
 * - Prevents invalid state combinations
 * - Great for complex multi-step TAN processes
 *
 * Cons:
 * - Overkill for simple TAN scenarios
 * - Requires more boilerplate code
 * - Learning curve for state machine concepts
 */

import type { BankAnswer } from "../../client/types/fints";

type TanState =
	| "idle"
	| "requesting"
	| "pending"
	| "submitting"
	| "success"
	| "failed"
	| "cancelled";

interface TanContext {
	challenge?: string;
	reference?: string;
	bankAnswers?: BankAnswer[];
	tan?: string;
	error?: string;
	attempts: number;
	maxAttempts: number;
}

interface TanStateTransition {
	from: TanState;
	to: TanState;
	condition?: (context: TanContext) => boolean;
	action?: (context: TanContext) => Promise<void> | void;
}

class TanStateMachine {
	private currentState: TanState = "idle";
	private context: TanContext = { attempts: 0, maxAttempts: 3 };

	private transitions: TanStateTransition[] = [
		{ from: "idle", to: "requesting" },
		{ from: "requesting", to: "pending" },
		{ from: "pending", to: "submitting" },
		{
			from: "submitting",
			to: "success",
			condition: (ctx) => ctx.tan !== undefined,
		},
		{
			from: "submitting",
			to: "failed",
			condition: (ctx) => ctx.attempts >= ctx.maxAttempts,
		},
		{
			from: "submitting",
			to: "pending",
			condition: (ctx) => ctx.attempts < ctx.maxAttempts,
		},
		{ from: "pending", to: "cancelled" },
		{ from: "failed", to: "idle" },
		{ from: "success", to: "idle" },
	];

	async transition(
		to: TanState,
		updateContext?: Partial<TanContext>,
	): Promise<boolean> {
		const validTransition = this.transitions.find(
			(t) =>
				t.from === this.currentState &&
				t.to === to &&
				(!t.condition || t.condition(this.context)),
		);

		if (!validTransition) {
			throw new Error(`Invalid transition from ${this.currentState} to ${to}`);
		}

		// Update context
		if (updateContext) {
			Object.assign(this.context, updateContext);
		}

		// Execute transition action
		if (validTransition.action) {
			await validTransition.action(this.context);
		}

		this.currentState = to;
		return true;
	}

	getState(): TanState {
		return this.currentState;
	}

	getContext(): TanContext {
		return { ...this.context };
	}

	async requestTan(
		challenge: string,
		reference: string,
		bankAnswers?: BankAnswer[],
	): Promise<string> {
		await this.transition("requesting", { challenge, reference, bankAnswers });
		await this.transition("pending");

		return new Promise((resolve, reject) => {
			const checkState = () => {
				switch (this.currentState) {
					case "success":
						resolve(this.context.tan!);
						break;
					case "failed":
					case "cancelled":
						reject(
							new Error(
								`TAN authentication ${this.currentState}: ${this.context.error || "Unknown error"}`,
							),
						);
						break;
					default:
						setTimeout(checkState, 100); // Poll state
						break;
				}
			};
			checkState();
		});
	}

	async submitTan(tan: string): Promise<void> {
		const newAttempts = this.context.attempts + 1;

		// Simulate TAN validation
		const isValid = tan.length >= 4; // Simple validation

		if (isValid) {
			await this.transition("submitting", { tan, attempts: newAttempts });
			await this.transition("success");
		} else {
			await this.transition("submitting", {
				attempts: newAttempts,
				error: "Invalid TAN format",
			});
			if (newAttempts >= this.context.maxAttempts) {
				await this.transition("failed");
			} else {
				await this.transition("pending");
			}
		}
	}

	async cancel(): Promise<void> {
		if (this.currentState === "pending") {
			await this.transition("cancelled", { error: "User cancelled" });
		}
	}
}

// Usage Example:
export async function syncWithStateMachine() {
	const tanMachine = new TanStateMachine();

	try {
		console.log("Requesting TAN...");
		const tanPromise = tanMachine.requestTan("Enter SMS TAN", "ref123");

		// Simulate user interaction
		setTimeout(async () => {
			console.log("User submitting TAN...");
			await tanMachine.submitTan("123456");
		}, 2000);

		const tan = await tanPromise;
		console.log("TAN received:", tan);
	} catch (error) {
		console.error("TAN authentication failed:", error);
	}
}
