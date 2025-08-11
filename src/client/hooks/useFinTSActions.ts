import type {
	BalanceData,
	BankAnswer,
	BankingInformation,
	FinTSForm,
	FinTSResponse,
	StatementsData,
} from "../types/fints";
import { api } from "../utils/api";

export function useFinTSActions() {
	async function startSession(form: FinTSForm) {
		const res = await api<{
			bankingInformation: BankingInformation | null;
			requiresTan?: boolean;
			tanChallenge?: string;
			tanReference?: string;
			bankAnswers?: BankAnswer[];
		}>({ action: "startSession", payload: form });
		return res;
	}

	async function selectTan(tanMethodId: number, tanMediaName?: string) {
		const res = await api<
			{ bankingInformation: BankingInformation } | { error: string }
		>({
			action: "selectTan",
			payload: {
				tanMethodId,
				tanMediaName,
			},
		});
		if ("error" in res) throw new Error(res.error);
		return res.bankingInformation;
	}

	async function synchronize() {
		const res = await api<
			FinTSResponse<{ bankingInformation: BankingInformation }>
		>({
			action: "synchronize",
		});
		return res;
	}

	async function getAccountBalance(accountNumber: string) {
		const res = await api<FinTSResponse<BalanceData>>({
			action: "getAccountBalance",
			payload: { accountNumber },
		});
		return res;
	}

	async function getAccountStatements(accountNumber: string) {
		const res = await api<FinTSResponse<StatementsData>>({
			action: "getAccountStatements",
			payload: { accountNumber },
		});
		return res;
	}

	async function submitTan(
		op: "sync" | "balance" | "statements",
		tanReference: string,
		tan: string,
	) {
		const res = await api<
			FinTSResponse<
				| { bankingInformation: BankingInformation }
				| BalanceData
				| StatementsData
			>
		>({
			action: "submitTan",
			payload: { op, tanReference, tan },
		});
		return res;
	}

	return {
		startSession,
		selectTan,
		synchronize,
		getAccountBalance,
		getAccountStatements,
		submitTan,
	};
}
