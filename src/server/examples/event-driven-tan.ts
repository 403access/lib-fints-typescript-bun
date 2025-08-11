/**
 * Event-Driven TAN Authentication Pattern
 *
 * Pros:
 * - Loosely coupled components
 * - Multiple listeners can react to TAN events
 * - Easy to add logging, analytics, notifications
 * - Natural fit for real-time applications
 *
 * Cons:
 * - More complex setup
 * - Harder to debug flow
 * - Potential memory leaks with listeners
 */

import { EventEmitter } from "events";

interface TanEvent {
	challenge: string;
	reference: string;
	bankAnswers?: any[];
	sessionId: string;
}

interface TanResponseEvent {
	tan: string;
	sessionId: string;
	cancel?: boolean;
}

class TanAuthenticator extends EventEmitter {
	private pendingSessions = new Map<
		string,
		(response: TanResponseEvent) => void
	>();

	async requestTan(
		challenge: string,
		reference: string,
		bankAnswers?: any[],
	): Promise<string> {
		const sessionId = Math.random().toString(36);

		return new Promise((resolve, reject) => {
			// Store resolver for this session
			this.pendingSessions.set(sessionId, (response) => {
				if (response.cancel) {
					reject(new Error("TAN authentication cancelled"));
				} else {
					resolve(response.tan);
				}
				this.pendingSessions.delete(sessionId);
			});

			// Emit TAN request event
			this.emit("tanRequired", {
				challenge,
				reference,
				bankAnswers,
				sessionId,
			} as TanEvent);

			// Set timeout
			setTimeout(() => {
				if (this.pendingSessions.has(sessionId)) {
					this.pendingSessions.delete(sessionId);
					reject(new Error("TAN authentication timeout"));
				}
			}, 300000); // 5 minutes
		});
	}

	submitTan(sessionId: string, tan: string, cancel = false) {
		const resolver = this.pendingSessions.get(sessionId);
		if (resolver) {
			resolver({ tan, sessionId, cancel });
		}
	}
}

// Usage Example:
export async function syncWithEventDriven(credentials: any) {
	const tanAuth = new TanAuthenticator();

	// Set up UI handler
	tanAuth.on("tanRequired", (event: TanEvent) => {
		console.log(`TAN Required: ${event.challenge}`);
		// In real app: show UI, send notification, etc.

		// Simulate user input after 2 seconds
		setTimeout(() => {
			tanAuth.submitTan(event.sessionId, "123456");
		}, 2000);
	});

	// Banking logic uses the authenticator
	try {
		const tan = await tanAuth.requestTan("Enter SMS TAN", "ref123");
		console.log("Received TAN:", tan);
	} catch (error) {
		console.error("TAN failed:", error);
	}
}
