// FinTS type definitions

export type BankAnswer = { code: number; text: string };

export type TanMediaRequirement = "NotRequired" | "Optional" | "Required";

export type TanMethod = {
	id: number;
	name: string;
	version: number;
	activeTanMediaCount: number;
	activeTanMedia: string[];
	tanMediaRequirement: TanMediaRequirement;
};

export type BankingInformation = {
	systemId: string;
	bpd?: {
		availableTanMethodIds: number[];
		tanMethods?: Record<number, TanMethod>;
	};
	upd?: {
		bankAccounts: Array<{
			accountNumber: string;
			iban?: string;
			bic?: string;
			currency?: string;
			productName?: string;
		}>;
	};
	bankMessages: Array<{ subject?: string; text: string }>;
};

export type FinTSResponse<T = unknown> = {
	success: boolean;
	requiresTan?: boolean;
	tanChallenge?: string;
	tanReference?: string;
	bankAnswers?: BankAnswer[];
	bankingInformationUpdated?: boolean;
	data?: T;
};

export type BalanceData = {
	accountNumber: string;
	bookedBalance: { amount: number; currency: string };
	availableBalance?: { amount: number; currency: string };
};

export type StatementEntry = {
	bookingDate: string; // ISO date
	valutaDate?: string; // ISO date
	amount: { amount: number; currency: string };
	text?: string;
	counterpart?: string;
	reference?: string;
};

export type StatementsData = {
	accountNumber: string;
	entries: StatementEntry[];
};

export type FinTSForm = {
	productId: string;
	productVersion: string;
	bankUrl: string;
	bankId: string;
	userId: string;
	pin: string;
};
