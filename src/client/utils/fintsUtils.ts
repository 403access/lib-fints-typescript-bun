import type { BankAnswer } from "../types/fints";

/**
 * Common FinTS response codes
 * Reference: FinTS 3.0 specification
 */
export const FINTS_RESPONSE_CODES = {
	// Success codes (HIRMS/HIRMG)
	SUCCESS: 20, // 0020 "Auftrag ausgeführt"
	SUCCESS_PENDING: 10, // 0010 "vorgemerkt" (transaction pending)
	SUCCESS_WITH_WARNINGS: 30,

	// Information codes
	STRONG_AUTHENTICATION_REQUIRED: 3060, // Decoupled TAN process required
	TAN_REQUIRED: 3920, // Traditional TAN required
	TAN_INVALID: 3955,
	TAN_EXPIRED: 3956,

	// Error codes
	INVALID_PIN: 9340,
	PIN_LOCKED: 9942,
	USER_LOCKED: 9210,
	PIN_TEMPORARILY_BLOCKED: 3938, // PIN temporarily blocked
	LOGIN_FAILED: 9900, // Login failed
	MESSAGE_CONTAINS_ERRORS: 9050, // Message contains errors
	DIALOG_ABORTED: 9800, // Dialog aborted

	// Decoupled/App-based TAN codes (Process 4/S)
	DECOUPLED_TAN_PENDING: 3060, // Same as STRONG_AUTHENTICATION_REQUIRED - decoupled required
	DECOUPLED_TAN_NOT_YET_APPROVED: 3076, // Waiting for approval in app
	DECOUPLED_TAN_CANCELLED: 3077, // User cancelled in app
	DECOUPLED_TAN_EXPIRED: 3078, // TAN expired in app

	// Additional decoupled status codes
	DECOUPLED_TAN_SENT_TO_DEVICE: 3072, // TAN sent to mobile device
	DECOUPLED_TAN_DEVICE_NOT_AVAILABLE: 3073, // Mobile device not available
} as const;

/**
 * Check if any bank answer contains a specific response code
 */
export function hasBankAnswerCode(
	bankAnswers: BankAnswer[] | undefined,
	code: number,
): boolean {
	return bankAnswers?.some((answer) => answer.code === code) ?? false;
}

/**
 * Check if the response indicates a decoupled TAN method is pending approval
 * This checks for the "waiting" status codes while the user approves in the app
 */
export function isDecoupledTanPending(
	bankAnswers: BankAnswer[] | undefined,
): boolean {
	return (
		hasBankAnswerCode(
			bankAnswers,
			FINTS_RESPONSE_CODES.DECOUPLED_TAN_PENDING,
		) ||
		hasBankAnswerCode(
			bankAnswers,
			FINTS_RESPONSE_CODES.DECOUPLED_TAN_NOT_YET_APPROVED,
		) ||
		hasBankAnswerCode(
			bankAnswers,
			FINTS_RESPONSE_CODES.DECOUPLED_TAN_SENT_TO_DEVICE,
		)
	);
}

/**
 * Check if the response indicates a successful transaction completion
 * This is what we look for to know the decoupled TAN was approved
 */
export function isTransactionSuccess(
	bankAnswers: BankAnswer[] | undefined,
): boolean {
	return (
		hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.SUCCESS) ||
		hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.SUCCESS_PENDING)
	);
}

/**
 * Check if the decoupled TAN was cancelled or failed
 */
export function isDecoupledTanFailed(
	bankAnswers: BankAnswer[] | undefined,
): boolean {
	return (
		hasBankAnswerCode(
			bankAnswers,
			FINTS_RESPONSE_CODES.DECOUPLED_TAN_CANCELLED,
		) ||
		hasBankAnswerCode(
			bankAnswers,
			FINTS_RESPONSE_CODES.DECOUPLED_TAN_EXPIRED,
		) ||
		hasBankAnswerCode(
			bankAnswers,
			FINTS_RESPONSE_CODES.DECOUPLED_TAN_DEVICE_NOT_AVAILABLE,
		)
	);
}

/**
 * Check if the response indicates strong authentication is required
 */
export function isStrongAuthRequired(
	bankAnswers: BankAnswer[] | undefined,
): boolean {
	return hasBankAnswerCode(
		bankAnswers,
		FINTS_RESPONSE_CODES.STRONG_AUTHENTICATION_REQUIRED,
	);
}

/**
 * Check if the response indicates TAN is required
 */
export function isTanRequired(bankAnswers: BankAnswer[] | undefined): boolean {
	return hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.TAN_REQUIRED);
}

/**
 * Check if the response indicates TAN is invalid
 */
export function isTanInvalid(bankAnswers: BankAnswer[] | undefined): boolean {
	return hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.TAN_INVALID);
}

/**
 * Check if the response indicates PIN is invalid
 */
export function isPinInvalid(bankAnswers: BankAnswer[] | undefined): boolean {
	return hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.INVALID_PIN);
}

/**
 * Check if the response indicates user/PIN is locked
 */
export function isUserLocked(bankAnswers: BankAnswer[] | undefined): boolean {
	return (
		hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.PIN_LOCKED) ||
		hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.USER_LOCKED) ||
		hasBankAnswerCode(
			bankAnswers,
			FINTS_RESPONSE_CODES.PIN_TEMPORARILY_BLOCKED,
		) ||
		hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.LOGIN_FAILED)
	);
}

/**
 * Get a user-friendly error message based on bank response codes
 */
export function getBankErrorMessage(
	bankAnswers: BankAnswer[] | undefined,
): string | null {
	if (!bankAnswers || bankAnswers.length === 0) {
		return null;
	}

	// Check for decoupled TAN specific states first
	if (isDecoupledTanFailed(bankAnswers)) {
		return "Die TAN-Freigabe wurde abgebrochen oder ist abgelaufen. Bitte versuchen Sie es erneut.";
	}

	if (isDecoupledTanPending(bankAnswers)) {
		return "Bitte geben Sie die Transaktion in Ihrer Banking-App frei und versuchen Sie es erneut.";
	}

	if (isPinInvalid(bankAnswers)) {
		return "Ungültige PIN. Bitte überprüfen Sie Ihre Eingabe.";
	}

	if (isUserLocked(bankAnswers)) {
		// Check for specific PIN blocking codes
		if (
			hasBankAnswerCode(
				bankAnswers,
				FINTS_RESPONSE_CODES.PIN_TEMPORARILY_BLOCKED,
			)
		) {
			return "Ihr Zugang ist vorläufig gesperrt. Bitte heben Sie die PIN-Sperre über die Website oder App Ihrer Bank auf.";
		}
		if (hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.LOGIN_FAILED)) {
			return "Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten oder entsperren Sie Ihren Zugang.";
		}
		return "Ihr Zugang ist gesperrt. Bitte wenden Sie sich an Ihre Bank.";
	}

	if (isTanInvalid(bankAnswers)) {
		return "Ungültige TAN. Bitte versuchen Sie es erneut.";
	}

	// Return the first non-success message
	const errorAnswer = bankAnswers.find(
		(answer) =>
			answer.code >= 9000 || // Error range
			(answer.code >= 3000 && answer.code < 4000), // Warning range
	);

	return errorAnswer?.text || null;
}

/**
 * Check if a TAN challenge is for a decoupled method based on response codes
 * Detects decoupled/pushTAN scenarios (Process 4/S in FinTS)
 */
export function isDecoupledTanChallenge(
	bankAnswers: BankAnswer[] | undefined,
): boolean {
	// Check for strong authentication required (3060) which indicates decoupled process
	if (isStrongAuthRequired(bankAnswers)) {
		return true;
	}

	// Also check for explicit decoupled status codes
	if (isDecoupledTanPending(bankAnswers)) {
		return true;
	}

	return false;
}

/**
 * Determines if automatic push TAN polling should be used for a FinTS response
 * This checks if the response indicates a decoupled TAN process that can be handled automatically
 */
export function shouldUseAutomaticPolling(response: {
	requiresTan?: boolean;
	tanReference?: string;
	bankAnswers?: BankAnswer[];
}): boolean {
	return !!(
		response.requiresTan &&
		response.tanReference &&
		isDecoupledTanChallenge(response.bankAnswers)
	);
}

/**
 * Extracts operation information from a pending TAN state for polling
 */
export function extractPollingInfo(response: {
	requiresTan?: boolean;
	tanReference?: string;
	bankAnswers?: BankAnswer[];
}): {
	tanReference: string;
	operation: string;
} | null {
	if (!shouldUseAutomaticPolling(response)) {
		return null;
	}

	// Extract operation from context or determine from bank answers
	// This is a simplified version - in practice you might need more context
	const tanReference = response.tanReference;
	if (!tanReference) {
		return null;
	}

	return {
		tanReference,
		operation: "sync", // Default operation, could be enhanced to detect actual operation
	};
}
