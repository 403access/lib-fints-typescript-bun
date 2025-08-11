/**
 * Promise Queue TAN Authentication Pattern
 *
 * Pros:
 * - Natural async/await flow
 * - Built-in queuing for multiple TAN requests
 * - Easy timeout and retry handling
 * - Composable with other Promise-based APIs
 *
 * Cons:
 * - Queue can grow if TAN requests are frequent
 * - Less control over individual TAN sessions
 * - Memory usage with large queues
 */

import type { BankAnswer } from "../../client/types/fints.js";

interface TanRequest {
	id: string;
	challenge: string;
	reference: string;
	bankAnswers?: BankAnswer[];
	timestamp: number;
	resolve: (tan: string) => void;
	reject: (error: Error) => void;
}

interface TanResponse {
	requestId: string;
	tan: string;
	cancel?: boolean;
}

class TanQueue {
	private queue: Map<string, TanRequest> = new Map();
	private onTanRequired?: (request: TanRequest) => void;
	private timeout: number = 300000; // 5 minutes

	setTanHandler(handler: (request: TanRequest) => void) {
		this.onTanRequired = handler;
	}

	setTimeout(ms: number) {
		this.timeout = ms;
	}

	async requestTan(
		challenge: string,
		reference: string,
		bankAnswers?: BankAnswer[],
	): Promise<string> {
		const id = `tan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		return new Promise<string>((resolve, reject) => {
			const request: TanRequest = {
				id,
				challenge,
				reference,
				bankAnswers,
				timestamp: Date.now(),
				resolve,
				reject,
			};

			// Add to queue
			this.queue.set(id, request);

			// Set timeout
			const timeoutId = setTimeout(() => {
				if (this.queue.has(id)) {
					this.queue.delete(id);
					reject(new Error(`TAN request timeout after ${this.timeout}ms`));
				}
			}, this.timeout);

			// Notify handler
			if (this.onTanRequired) {
				this.onTanRequired(request);
			} else {
				this.queue.delete(id);
				clearTimeout(timeoutId);
				reject(new Error("No TAN handler registered"));
			}
		});
	}

	submitTan(response: TanResponse): boolean {
		const request = this.queue.get(response.requestId);
		if (!request) {
			return false; // Request not found or already resolved
		}

		this.queue.delete(response.requestId);

		if (response.cancel) {
			request.reject(new Error("TAN authentication cancelled by user"));
		} else {
			request.resolve(response.tan);
		}

		return true;
	}

	cancelTan(requestId: string): boolean {
		const request = this.queue.get(requestId);
		if (!request) {
			return false;
		}

		this.queue.delete(requestId);
		request.reject(new Error("TAN authentication cancelled"));
		return true;
	}

	getPendingRequests(): TanRequest[] {
		return Array.from(this.queue.values());
	}

	clearAll(): void {
		for (const request of this.queue.values()) {
			request.reject(new Error("TAN queue cleared"));
		}
		this.queue.clear();
	}
}

// Global TAN queue instance
const globalTanQueue = new TanQueue();

// Usage functions
export function setupTanHandler(handler: (request: TanRequest) => void) {
	globalTanQueue.setTanHandler(handler);
}

export function requestTan(
	challenge: string,
	reference: string,
	bankAnswers?: BankAnswer[],
): Promise<string> {
	return globalTanQueue.requestTan(challenge, reference, bankAnswers);
}

export function submitTan(
	requestId: string,
	tan: string,
	cancel = false,
): boolean {
	return globalTanQueue.submitTan({ requestId, tan, cancel });
}

export function cancelTan(requestId: string): boolean {
	return globalTanQueue.cancelTan(requestId);
}

export function getPendingTanRequests(): TanRequest[] {
	return globalTanQueue.getPendingRequests();
}

// Example Usage:
export async function syncWithQueue() {
	// Setup handler (typically done once in app initialization)
	setupTanHandler((request) => {
		console.log(`TAN Required [${request.id}]: ${request.challenge}`);

		// In real app: show UI, send to mobile app, etc.

		// Simulate user response after 2 seconds
		setTimeout(() => {
			submitTan(request.id, "123456");
		}, 2000);
	});

	try {
		// Request TAN (can be called from anywhere in the app)
		console.log("Requesting TAN...");
		const tan = await requestTan("Enter SMS TAN", "ref123");
		console.log("Received TAN:", tan);

		// Multiple concurrent TAN requests are queued automatically
		const [tan1, tan2] = await Promise.all([
			requestTan("TAN for transfer", "ref456"),
			requestTan("TAN for balance", "ref789"),
		]);

		console.log("Received multiple TANs:", { tan1, tan2 });
	} catch (error) {
		console.error("TAN authentication failed:", error);
	}
}
