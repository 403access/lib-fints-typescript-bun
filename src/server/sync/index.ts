/**
 * FinTS Server Sync Module
 *
 * Barrel export file for the FinTS synchronization functionality.
 * This provides a clean interface to all the sync module components.
 */

// Main sync functions
export {
	syncAccountStatements,
	syncAllStatements,
} from "./sync";
// Pre-built TAN callback implementations
export {
	createAutomaticPushTanCallback,
	createCommandLineTanCallback,
} from "./tanCallbacks";
// TAN handling utilities
export { handlePushTanWithPolling } from "./tanHandler";
// Type definitions
export type * from "./types";
// Validation utilities
export { validateCredentials } from "./validation";
