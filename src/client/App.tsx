// FinTSWizard.tsx
// A self-contained React + TypeScript + Tailwind component that guides a user
// through a FinTS PIN/TAN flow using a tiny backend wrapper around `lib-fints`.
//
// ⚠️ Important: lib-fints is Node-only. Do NOT call banks directly from the browser.
// This component expects a backend endpoint at `/api/fints` (see the example
// route handler further below). Adjust `API_URL` if needed.

import { useMemo, useState } from "react";
import { AccountOperations } from "./components/AccountOperations";
import { BankMessages } from "./components/BankMessages";
import { CredentialsForm } from "./components/CredentialsForm";
import { Section } from "./components/Section";
import { TanChallenge } from "./components/TanChallenge";
import { TanSelection } from "./components/TanSelection";
import { useFinTSActions } from "./hooks/useFinTSActions";
import type {
    BalanceData,
    BankingInformation,
    FinTSForm,
    StatementsData,
} from "./types/fints";

export default function FinTSWizard() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const actions = useFinTSActions();

    // Step 1: credentials & product details
    const [form, setForm] = useState<FinTSForm>({
        productId: process.env.PUBLIC_FINTS_PRODUCT_REGISTER_ID!, // register at DK/FinTS
        productVersion: "1.0.0",
        bankUrl: "https://banking-bw4.s-fints-pt-bw.de/fints30",
        bankId: "60450050", // BLZ or Bank ID
        userId: "",
        pin: "",
    });

    const canStart = useMemo(
        () =>
            !!form.productId &&
            !!form.productVersion &&
            !!form.bankUrl &&
            !!form.bankId &&
            !!form.userId &&
            !!form.pin,
        [form],
    );

    // persisted banking information returned by backend after sync
    const [bankingInformation, setBankingInformation] =
        useState<BankingInformation | null>(null);

    // TAN selection
    const [selectedTanMethodId, setSelectedTanMethodId] = useState<number | null>(
        null,
    );
    const [selectedTanMedia, setSelectedTanMedia] = useState<string>("");

    // Accounts
    const [accountIdx, setAccountIdx] = useState(0);

    // TAN challenge state
    const [tanChallenge, setTanChallenge] = useState<string | null>(null);
    const [tanReference, setTanReference] = useState<string | null>(null);
    const [tanInput, setTanInput] = useState("");
    const [pendingOp, setPendingOp] = useState<
        "sync" | "balance" | "statements" | null
    >(null);

    // Results
    const [balance, setBalance] = useState<BalanceData | null>(null);
    const [statements, setStatements] = useState<StatementsData | null>(null);

    // Utilities
    function onChange<K extends keyof FinTSForm>(key: K, value: FinTSForm[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function resetTan() {
        setTanChallenge(null);
        setTanReference(null);
        setTanInput("");
        setPendingOp(null);
    }

    function resetAll() {
        setBankingInformation(null);
        setBalance(null);
        setStatements(null);
        resetTan();
    }

    // Actions
    async function startSession() {
        setError(null);
        setBusy(true);
        resetTan();
        try {
            const res = await actions.startSession(form);
            setBankingInformation(res.bankingInformation);

            // Check if TAN is required for initial session
            if (res.requiresTan) {
                setTanChallenge(res.tanChallenge || "TAN required for initial connection");
                setTanReference(res.tanReference || null);
                setPendingOp("sync");
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function selectTan() {
        if (!selectedTanMethodId) return;
        setError(null);
        setBusy(true);
        try {
            const bankingInfo = await actions.selectTan(
                selectedTanMethodId,
                selectedTanMedia || undefined,
            );
            setBankingInformation(bankingInfo);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function synchronize() {
        setError(null);
        setBusy(true);
        resetTan();
        try {
            const res = await actions.synchronize();
            if (res.requiresTan) {
                setTanChallenge(res.tanChallenge || "TAN required");
                setTanReference(res.tanReference || null);
                setPendingOp("sync");
            }
            if (res.success && res.data) {
                setBankingInformation(res.data.bankingInformation);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function getBalance() {
        if (!bankingInformation?.upd?.bankAccounts?.length) return;
        const account = bankingInformation.upd.bankAccounts[accountIdx];
        setError(null);
        setBusy(true);
        resetTan();
        try {
            const res = await actions.getAccountBalance(account.accountNumber);
            if (res.requiresTan) {
                setTanChallenge(res.tanChallenge || "TAN required");
                setTanReference(res.tanReference || null);
                setPendingOp("balance");
            }
            if (res.success && res.data) setBalance(res.data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function getStatements() {
        if (!bankingInformation?.upd?.bankAccounts?.length) return;
        const account = bankingInformation.upd.bankAccounts[accountIdx];
        setError(null);
        setBusy(true);
        resetTan();
        try {
            const res = await actions.getAccountStatements(account.accountNumber);
            if (res.requiresTan) {
                setTanChallenge(res.tanChallenge || "TAN required");
                setTanReference(res.tanReference || null);
                setPendingOp("statements");
            }
            if (res.success && res.data) setStatements(res.data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function submitTan() {
        if (!tanReference || !pendingOp) return;
        setBusy(true);
        setError(null);
        try {
            const res = await actions.submitTan(pendingOp, tanReference, tanInput);
            if (!res.success)
                throw new Error(
                    res.bankAnswers?.map((b) => b.text).join("\n") || "TAN failed",
                );
            if (pendingOp === "sync" && res.data && typeof res.data === "object" && "bankingInformation" in res.data) {
                setBankingInformation(res.data.bankingInformation as BankingInformation);
            } else if (pendingOp === "balance" && res.data) {
                setBalance(res.data as BalanceData);
            } else if (pendingOp === "statements" && res.data) {
                setStatements(res.data as StatementsData);
            }
            resetTan();
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);

            // Check if this is a pending approval error (status 202)
            if (errorMessage.includes("TAN approval still pending") ||
                errorMessage.includes("noch nicht freigegeben")) {
                setError("Bitte geben Sie die Transaktion in Ihrer Banking-App frei und versuchen Sie es erneut.");
                // Don't reset TAN state, keep the challenge active for retry
                return;
            }

            setError(errorMessage);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">FinTS PIN/TAN Wizard</h1>
                <div className="text-xs text-slate-500">
                    Demo • React + TS + Tailwind
                </div>
            </header>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <Section title="1) Product & Banking Credentials">
                <CredentialsForm
                    form={form}
                    canStart={canStart}
                    busy={busy}
                    onChange={onChange}
                    onStartSession={startSession}
                    onReset={resetAll}
                />
            </Section>

            <Section
                title="2) TAN Method & Synchronize"
                right={
                    <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
                        onClick={synchronize}
                        disabled={busy}
                    >
                        Sync
                    </button>
                }
            >
                {bankingInformation ? (
                    <div className="space-y-4">
                        <TanSelection
                            bankingInformation={bankingInformation}
                            selectedTanMethodId={selectedTanMethodId}
                            selectedTanMedia={selectedTanMedia}
                            busy={busy}
                            onTanMethodChange={setSelectedTanMethodId}
                            onTanMediaChange={setSelectedTanMedia}
                            onSelectTan={selectTan}
                        />

                        <AccountOperations
                            bankingInformation={bankingInformation}
                            accountIdx={accountIdx}
                            busy={busy}
                            balance={balance}
                            statements={statements}
                            onAccountChange={setAccountIdx}
                            onGetBalance={getBalance}
                            onGetStatements={getStatements}
                        />
                    </div>
                ) : (
                    <div className="text-sm text-slate-600">
                        Start a session to load bank parameters and accounts.
                    </div>
                )}
            </Section>

            {tanChallenge && (
                <Section title="TAN Challenge">
                    <TanChallenge
                        tanChallenge={tanChallenge}
                        tanInput={tanInput}
                        busy={busy}
                        error={error}
                        onTanInputChange={setTanInput}
                        onSubmitTan={submitTan}
                        onCancel={resetTan}
                    />
                </Section>
            )}

            {bankingInformation && (
                <Section title="Bank Messages">
                    <BankMessages bankingInformation={bankingInformation} />
                </Section>
            )}

            <footer className="text-xs text-slate-500 text-center">
                This demo stores session data in-memory on the server for convenience.
                Replace with a DB/Redis in production.
            </footer>
        </div>
    );
}