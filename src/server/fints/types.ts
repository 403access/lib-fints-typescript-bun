import type { FinTSClient, FinTSConfig } from "lib-fints";

export type Session = {
	client: FinTSClient | null;
	config: FinTSConfig | null;
	pending?: {
		op:
			| "sync"
			| "balance"
			| "statements"
			| "getAllBalances"
			| "getAllStatements";
		accountNumber?: string;
	};
};

export type SessionManager = {
	id: string;
	session: Session;
	setCookie?: string;
};

export type FinTSAction =
	| "startSession"
	| "selectTan"
	| "synchronize"
	| "getAccountBalance"
	| "getAccountStatements"
	| "getAllBalances"
	| "getAllStatements"
	| "submitTan";

export type FinTSRequest = {
	action: FinTSAction;
	payload?: Record<string, unknown>;
};

export type FinTSResponse = {
	success?: boolean;
	data?: unknown;
	error?: string;
	requiresTan?: boolean;
	tanChallenge?: string;
	tanReference?: string;
	bankAnswers?: Array<{ code: number; text: string }>;
	bankingInformation?: unknown;
	isPending?: boolean;
};
