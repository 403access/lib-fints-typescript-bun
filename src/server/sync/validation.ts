/**
 * Validation utilities for FinTS sync credentials
 */

import type { SyncCredentials } from "./types.js";

/**
 * Helper function to validate credentials
 */
export function validateCredentials(
	credentials: Partial<SyncCredentials>,
): string[] {
	const errors: string[] = [];
	const required = [
		"productId",
		"productVersion",
		"bankUrl",
		"bankId",
		"userId",
		"pin",
	];

	for (const field of required) {
		if (!credentials[field as keyof SyncCredentials]) {
			errors.push(`Missing required field: ${field}`);
		}
	}

	return errors;
}
