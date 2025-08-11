/**
 * FinTS Server Sync Module
 *
 * Barrel export file for the FinTS synchronization functionality.
 * This provides a clean interface to all the sync module components.
 */

// Main sync functions
export {
	syncAllStatements,
	syncAccountStatements,
} from "./sync.js";

// TAN handling utilities
export { handlePushTanWithPolling } from "./tanHandler.js";

// Pre-built TAN callback implementations
export {
	createCommandLineTanCallback,
	createAutomaticPushTanCallback,
} from "./tanCallbacks.js";

// Validation utilities
export { validateCredentials } from "./validation.js";

// Type definitions
export type * from "./types.js";
