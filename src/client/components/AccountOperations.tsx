import type { BalanceData, BankingInformation, StatementsData } from "../types/fints";

export interface AccountOperationsProps {
    bankingInformation: BankingInformation;
    accountIdx: number;
    busy: boolean;
    balance: BalanceData | null;
    statements: StatementsData | null;
    onAccountChange: (index: number) => void;
    onGetBalance: () => void;
    onGetStatements: () => void;
}

export function AccountOperations({
    bankingInformation,
    accountIdx,
    busy,
    balance,
    statements,
    onAccountChange,
    onGetBalance,
    onGetStatements,
}: AccountOperationsProps) {
    const accounts = bankingInformation?.upd?.bankAccounts ?? [];

    if (accounts.length === 0) {
        return (
            <div className="text-sm text-slate-600">
                No accounts yet — run Sync after selecting a TAN method.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="account-select" className="text-sm text-slate-600">
                    Account:
                </label>
                <select
                    id="account-select"
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    value={accountIdx}
                    onChange={(e) => onAccountChange(Number(e.target.value))}
                >
                    {accounts.map((a, i) => (
                        <option key={a.accountNumber} value={i}>
                            {a.iban || a.accountNumber}{" "}
                            {a.currency ? `(${a.currency})` : ""}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
                    onClick={onGetBalance}
                    disabled={busy}
                >
                    Get Balance
                </button>
                <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
                    onClick={onGetStatements}
                    disabled={busy}
                >
                    Get Statements
                </button>
            </div>

            {balance && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <div className="font-medium">Balance</div>
                    <div className="font-mono">
                        {balance.bookedBalance.amount.toFixed(2)}{" "}
                        {balance.bookedBalance.currency}
                    </div>
                </div>
            )}

            {statements && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                            <tr>
                                <th className="px-3 py-2 text-left">Booking</th>
                                <th className="px-3 py-2 text-left">Valuta</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                                <th className="px-3 py-2 text-left">Text</th>
                                <th className="px-3 py-2 text-left">Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statements.entries.map((e, idx) => (
                                <tr
                                    key={`${e.bookingDate}-${e.amount.amount}-${idx}`}
                                    className={idx % 2 ? "bg-slate-50" : "bg-white"}
                                >
                                    <td className="px-3 py-2">
                                        {new Date(e.bookingDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2">
                                        {e.valutaDate
                                            ? new Date(e.valutaDate).toLocaleDateString()
                                            : ""}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">
                                        {e.amount.amount.toFixed(2)} {e.amount.currency}
                                    </td>
                                    <td className="px-3 py-2">
                                        {e.text || e.counterpart || ""}
                                    </td>
                                    <td className="px-3 py-2">{e.reference || ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
