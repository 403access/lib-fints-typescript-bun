export const API_URL = "/api/fints"; // change if needed

export async function api<T>(body: Record<string, unknown>): Promise<T> {
	const res = await fetch(API_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		credentials: "include",
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()) as T;
}

/**
 * Automatically polls for push TAN status when a decoupled TAN is required
 * This handles the HKTAN status polling according to FinTS specification
 */
export async function pollTanStatusAutomatically<T>(
	tanReference: string,
	operation: string,
	accountNumber?: string,
	options: {
		maxAttempts?: number;
		intervalMs?: number;
		onPollingUpdate?: (attempt: number, maxAttempts: number) => void;
	} = {}
): Promise<T> {
	const { maxAttempts = 60, intervalMs = 5000, onPollingUpdate } = options;

	console.log(`🔄 Starting automatic push TAN polling for ${operation}`);
	
	// Start polling immediately
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (onPollingUpdate) {
			onPollingUpdate(attempt, maxAttempts);
		}

		try {
			const result = await api<T>({
				action: "pollTanStatus",
				payload: {
					tanReference,
					operation,
					accountNumber,
					maxAttempts: 1, // Poll once per call
					intervalMs: 0   // No delay in server
				}
			});

			// If we get a result without error, the polling was successful
			console.log("✅ Push TAN approved successfully!");
			return result;

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Check if this is a pending status (need to continue polling)
			if (errorMessage.includes("still pending") || 
				errorMessage.includes("not yet approved") ||
				errorMessage.includes("3076")) {
				
				console.log(`⏳ Still waiting for push TAN approval (attempt ${attempt}/${maxAttempts})...`);
				
				// Wait before next attempt
				if (attempt < maxAttempts) {
					await new Promise(resolve => setTimeout(resolve, intervalMs));
				}
				continue;
			}

			// For any other error, rethrow it
			throw error;
		}
	}

	throw new Error(`Push TAN approval timeout after ${maxAttempts} attempts. Please check your banking app and try again.`);
}
