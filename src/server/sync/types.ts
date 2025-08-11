/**
 * Type definitions for the FinTS sync module
 */

import type {
	FinTSForm,
	BankAnswer,
	BankingInformation,
} from "../../client/types/fints.js";

export type SyncCredentials = FinTSForm;

export interface AccountStatementsOptions {
	accountNumber?: string; // If not provided, will get statements for all accounts
	startDate?: Date;
	endDate?: Date;
}

export interface TanCallbackResult {
	tan: string;
	cancel?: boolean;
}

export type TanCallback = (
	tanChallenge: string,
	tanReference: string,
	bankAnswers?: BankAnswer[],
) => Promise<TanCallbackResult>;

export interface PushTanPollingOptions {
	maxAttempts?: number;
	intervalMs?: number;
	timeoutMs?: number;
}

export interface StatementResponse {
	success: boolean;
	statements?: unknown;
	bankAnswers?: BankAnswer[];
}

export interface SyncResult {
	success: boolean;
	data?: {
		statements: Record<string, unknown>; // Using unknown to match lib-fints return type
		accounts: Array<{
			accountNumber: string;
			iban?: string;
			currency?: string;
		}>;
	};
	error?: string;
	bankingInformation?: BankingInformation;
}
