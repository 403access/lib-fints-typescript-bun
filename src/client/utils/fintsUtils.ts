import type { BankAnswer } from "../types/fints";

/**
 * Common FinTS response codes
 * Reference: FinTS 3.0 specification
 */
export const FINTS_RESPONSE_CODES = {
	// Success codes
	SUCCESS: 20,
	SUCCESS_WITH_WARNINGS: 30,

	// Information codes
	STRONG_AUTHENTICATION_REQUIRED: 3060,
	TAN_REQUIRED: 3920,
	TAN_INVALID: 3955,
	TAN_EXPIRED: 3956,

	// Error codes
	INVALID_PIN: 9340,
	PIN_LOCKED: 9942,
	USER_LOCKED: 9210,

	// Decoupled/App-based TAN codes
	DECOUPLED_TAN_PENDING: 3060,
	DECOUPLED_TAN_NOT_YET_APPROVED: 3076,
	DECOUPLED_TAN_CANCELLED: 3077,
	DECOUPLED_TAN_EXPIRED: 3078,
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
		hasBankAnswerCode(bankAnswers, FINTS_RESPONSE_CODES.USER_LOCKED)
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

	// Check for specific error conditions
	if (isDecoupledTanPending(bankAnswers)) {
		return "Bitte geben Sie die Transaktion in Ihrer Banking-App frei und versuchen Sie es erneut.";
	}

	if (isPinInvalid(bankAnswers)) {
		return "Ungültige PIN. Bitte überprüfen Sie Ihre Eingabe.";
	}

	if (isUserLocked(bankAnswers)) {
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
 */
export function isDecoupledTanChallenge(
	bankAnswers: BankAnswer[] | undefined,
): boolean {
	if (isDecoupledTanPending(bankAnswers) || isStrongAuthRequired(bankAnswers)) {
		return true;
	}
	return false;
}
