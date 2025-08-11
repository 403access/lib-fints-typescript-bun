/**
 * Reactive Streams TAN Authentication Pattern
 *
 * Pros:
 * - Powerful stream composition and transformation
 * - Built-in backpressure handling
 * - Excellent for real-time applications
 * - Composable with other reactive streams
 * - Natural error handling and retry logic
 *
 * Cons:
 * - Learning curve for reactive programming
 * - Overkill for simple scenarios
 * - Requires reactive libraries (RxJS, etc.)
 * - Can be hard to debug
 */

import type { BankAnswer } from "../../client/types/fints.js";

// Simplified reactive stream implementation (normally you'd use RxJS)
interface Observer<T> {
	next: (value: T) => void;
	error: (error: Error) => void;
	complete: () => void;
}

interface Subscription {
	unsubscribe: () => void;
}

class Observable<T> {
	constructor(
		private subscriber: (observer: Observer<T>) => Subscription | (() => void),
	) {}

	subscribe(observer: Partial<Observer<T>>): Subscription {
		const fullObserver: Observer<T> = {
			next: observer.next || (() => {}),
			error: observer.error || (() => {}),
			complete: observer.complete || (() => {}),
		};

		const cleanup = this.subscriber(fullObserver);

		return {
			unsubscribe:
				typeof cleanup === "function" ? cleanup : cleanup.unsubscribe,
		};
	}

	map<U>(fn: (value: T) => U): Observable<U> {
		return new Observable<U>((observer) => {
			return this.subscribe({
				next: (value) => observer.next(fn(value)),
				error: (error) => observer.error(error),
				complete: () => observer.complete(),
			});
		});
	}

	filter(predicate: (value: T) => boolean): Observable<T> {
		return new Observable<T>((observer) => {
			return this.subscribe({
				next: (value) => {
					if (predicate(value)) {
						observer.next(value);
					}
				},
				error: (error) => observer.error(error),
				complete: () => observer.complete(),
			});
		});
	}

	static fromPromise<T>(promise: Promise<T>): Observable<T> {
		return new Observable<T>((observer) => {
			promise
				.then((value) => {
					observer.next(value);
					observer.complete();
				})
				.catch((error) => observer.error(error));

			return () => {}; // No cleanup needed for promise
		});
	}
}

// Subject for two-way communication
class Subject<T> extends Observable<T> {
	private observers: Observer<T>[] = [];

	constructor() {
		super((observer) => {
			this.observers.push(observer);
			return () => {
				const index = this.observers.indexOf(observer);
				if (index > -1) {
					this.observers.splice(index, 1);
				}
			};
		});
	}

	next(value: T): void {
		this.observers.forEach((observer) => observer.next(value));
	}

	error(error: Error): void {
		this.observers.forEach((observer) => observer.error(error));
	}

	complete(): void {
		this.observers.forEach((observer) => observer.complete());
	}
}

// TAN authentication streams
interface TanRequest {
	id: string;
	challenge: string;
	reference: string;
	bankAnswers?: BankAnswer[];
	timestamp: number;
}

interface TanResponse {
	requestId: string;
	tan: string;
	cancelled?: boolean;
}

class ReactiveTanService {
	private tanRequests$ = new Subject<TanRequest>();
	private tanResponses$ = new Subject<TanResponse>();
	private activeSessions = new Map<string, Observer<string>>();

	// Stream of TAN requests (for UI to subscribe to)
	getTanRequestStream(): Observable<TanRequest> {
		return this.tanRequests$;
	}

	// Submit TAN response
	submitTanResponse(response: TanResponse): void {
		this.tanResponses$.next(response);
	}

	// Request TAN authentication
	requestTan(
		challenge: string,
		reference: string,
		bankAnswers?: BankAnswer[],
	): Observable<string> {
		const id = `tan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		return new Observable<string>((observer) => {
			// Store observer for this session
			this.activeSessions.set(id, observer);

			// Emit TAN request
			this.tanRequests$.next({
				id,
				challenge,
				reference,
				bankAnswers,
				timestamp: Date.now(),
			});

			// Listen for responses
			const responseSubscription = this.tanResponses$
				.filter((response) => response.requestId === id)
				.subscribe({
					next: (response) => {
						if (response.cancelled) {
							observer.error(new Error("TAN authentication cancelled"));
						} else {
							observer.next(response.tan);
							observer.complete();
						}
						this.activeSessions.delete(id);
						responseSubscription.unsubscribe();
					},
					error: (error) => {
						observer.error(error);
						this.activeSessions.delete(id);
					},
				});

			// Timeout handling
			const timeout = setTimeout(() => {
				if (this.activeSessions.has(id)) {
					observer.error(new Error("TAN request timeout"));
					this.activeSessions.delete(id);
					responseSubscription.unsubscribe();
				}
			}, 300000); // 5 minutes

			// Cleanup function
			return () => {
				clearTimeout(timeout);
				this.activeSessions.delete(id);
				responseSubscription.unsubscribe();
			};
		});
	}

	// Get active sessions count
	getActiveSessionsCount(): number {
		return this.activeSessions.size;
	}
}

// Global reactive TAN service
const reactiveTanService = new ReactiveTanService();

// Setup TAN handling (typically in UI layer)
export function setupReactiveTanHandling() {
	reactiveTanService.getTanRequestStream().subscribe({
		next: (request) => {
			console.log(`🔐 TAN Required [${request.id}]: ${request.challenge}`);
			console.log(`Reference: ${request.reference}`);

			if (request.bankAnswers) {
				console.log("Bank messages:");
				request.bankAnswers.forEach((answer) => {
					console.log(`  [${answer.code}] ${answer.text}`);
				});
			}

			// Simulate user interaction
			setTimeout(() => {
				const tan = Math.random().toString().substr(2, 6); // Simulate TAN
				reactiveTanService.submitTanResponse({
					requestId: request.id,
					tan,
				});
			}, 2000);
		},
		error: (error) => {
			console.error("TAN request stream error:", error);
		},
	});
}

// Banking operations using reactive TAN
export async function syncWithReactiveStreams() {
	// Setup reactive TAN handling
	setupReactiveTanHandling();

	console.log("Starting reactive banking operations...");

	try {
		// Request TAN using reactive stream
		const tan$ = reactiveTanService.requestTan(
			"Enter SMS TAN for account access",
			"ref123",
		);

		// Convert observable to promise for easier usage
		const tan = await new Promise<string>((resolve, reject) => {
			const subscription = tan$.subscribe({
				next: resolve,
				error: reject,
				complete: () => subscription.unsubscribe(),
			});
		});

		console.log("✅ TAN received:", tan);

		// Multiple concurrent TAN requests
		const multiTan$ = [
			reactiveTanService.requestTan("TAN for transfer", "ref456"),
			reactiveTanService.requestTan("TAN for balance", "ref789"),
		];

		const multiTans = await Promise.all(
			multiTan$.map(
				(tan$) =>
					new Promise<string>((resolve, reject) => {
						const subscription = tan$.subscribe({
							next: resolve,
							error: reject,
							complete: () => subscription.unsubscribe(),
						});
					}),
			),
		);

		console.log("✅ Multiple TANs received:", multiTans);
	} catch (error) {
		console.error("❌ Reactive TAN authentication failed:", error);
	}

	console.log(
		`Active TAN sessions: ${reactiveTanService.getActiveSessionsCount()}`,
	);
}
