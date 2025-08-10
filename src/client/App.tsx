// FinTSWizard.tsx
// A self-contained React + TypeScript + Tailwind component that guides a user
// through a FinTS PIN/TAN flow using a tiny backend wrapper around `lib-fints`.
//
// ⚠️ Important: lib-fints is Node-only. Do NOT call banks directly from the browser.
// This component expects a backend endpoint at `/api/fints` (see the example
// route handler further below). Adjust `API_URL` if needed.

import React, { useMemo, useState } from "react";

// ------------------------------
// Types shared with the backend
// ------------------------------

type BankAnswer = { code: string; text: string };

type TanMediaRequirement = "NotRequired" | "Optional" | "Required"; // simplified

type TanMethod = {
    id: number;
    name: string;
    version: number;
    activeTanMediaCount: number;
    activeTanMedia: string[];
    tanMediaRequirement: TanMediaRequirement;
};

type BankingInformation = {
    systemId: string;
    bpd?: {
        availableTanMethodIds: number[];
        tanMethods?: Record<number, TanMethod>; // optional map for convenience
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

type FinTSResponse<T = unknown> = {
    success: boolean;
    requiresTan?: boolean;
    tanChallenge?: string;
    tanReference?: string;
    bankAnswers?: BankAnswer[];
    bankingInformationUpdated?: boolean;
    data?: T;
};

type BalanceData = {
    accountNumber: string;
    bookedBalance: { amount: number; currency: string };
    availableBalance?: { amount: number; currency: string };
};

type StatementEntry = {
    bookingDate: string; // ISO date
    valutaDate?: string; // ISO date
    amount: { amount: number; currency: string };
    text?: string;
    counterpart?: string;
    reference?: string;
};

type StatementsData = {
    accountNumber: string;
    entries: StatementEntry[];
};

// ------------------------------
// Minimal API client
// ------------------------------

const API_URL = "/api/fints"; // change if needed

async function api<T>(body: Record<string, unknown>): Promise<T> {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
}

// ------------------------------
// The Wizard Component
// ------------------------------

export default function FinTSWizard() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // session is maintained via cookie by the backend; no explicit id required

    // Step 1: credentials & product details
    const [form, setForm] = useState({
        productId: "com.example.myproduct", // register at DK/FinTS
        productVersion: "1.0.0",
        bankUrl: "https://banking-dkb.s-fints-pt-dkb.de/fints30",
        bankId: "12030000", // BLZ or Bank ID
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
    function onChange<K extends keyof typeof form>(
        key: K,
        value: (typeof form)[K],
    ) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function resetTan() {
        setTanChallenge(null);
        setTanReference(null);
        setTanInput("");
        setPendingOp(null);
    }

    // Actions
    async function startSession() {
        setError(null);
        setBusy(true);
        try {
            const res = await api<{
                bankingInformation: BankingInformation | null;
            }>({ action: "startSession", payload: form });
            setBankingInformation(res.bankingInformation);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    async function selectTan() {
        if (!selectedTanMethodId) return;
        setError(null);
        setBusy(true);
        try {
            const res = await api<
                { bankingInformation: BankingInformation } | { error: string }
            >({
                action: "selectTan",
                payload: {
                    tanMethodId: selectedTanMethodId,
                    tanMediaName: selectedTanMedia || undefined,
                },
            });
            if ("error" in res) throw new Error(res.error);
            setBankingInformation(res.bankingInformation);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    async function synchronize() {
        setError(null);
        setBusy(true);
        resetTan();
        try {
            const res = await api<
                FinTSResponse<{ bankingInformation: BankingInformation }>
            >({
                action: "synchronize",
            });
            if (res.requiresTan) {
                setTanChallenge(res.tanChallenge || "TAN required");
                setTanReference(res.tanReference || null);
                setPendingOp("sync");
            }
            if (res.success && res.data) {
                setBankingInformation(res.data.bankingInformation);
            }
        } catch (e: any) {
            setError(e.message || String(e));
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
            const res = await api<FinTSResponse<BalanceData>>({
                action: "getAccountBalance",
                payload: { accountNumber: account.accountNumber },
            });
            if (res.requiresTan) {
                setTanChallenge(res.tanChallenge || "TAN required");
                setTanReference(res.tanReference || null);
                setPendingOp("balance");
            }
            if (res.success && res.data) setBalance(res.data);
        } catch (e: any) {
            setError(e.message || String(e));
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
            const res = await api<FinTSResponse<StatementsData>>({
                action: "getAccountStatements",
                payload: { accountNumber: account.accountNumber },
            });
            if (res.requiresTan) {
                setTanChallenge(res.tanChallenge || "TAN required");
                setTanReference(res.tanReference || null);
                setPendingOp("statements");
            }
            if (res.success && res.data) setStatements(res.data);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    async function submitTan() {
        if (!tanReference || !pendingOp) return;
        setBusy(true);
        setError(null);
        try {
            const res = await api<FinTSResponse<any>>({
                action: "submitTan",
                payload: { op: pendingOp, tanReference, tan: tanInput },
            });
            if (!res.success)
                throw new Error(
                    res.bankAnswers?.map((b) => b.text).join("\n") || "TAN failed",
                );
            if (pendingOp === "sync" && res.data?.bankingInformation) {
                setBankingInformation(res.data.bankingInformation);
            } else if (pendingOp === "balance" && res.data) {
                setBalance(res.data as BalanceData);
            } else if (pendingOp === "statements" && res.data) {
                setStatements(res.data as StatementsData);
            }
            resetTan();
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    // UI helpers
    function Section({
        title,
        children,
        right,
    }: {
        title: string;
        children: React.ReactNode;
        right?: React.ReactNode;
    }) {
        return (
            <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
                    {right}
                </div>
                {children}
            </div>
        );
    }

    const accounts = bankingInformation?.upd?.bankAccounts ?? [];
    const tanMethodOptions = useMemo(() => {
        const ids = bankingInformation?.bpd?.availableTanMethodIds || [];
        const map = bankingInformation?.bpd?.tanMethods || {};
        return ids.map((id) => ({
            id,
            name: map[id]?.name || `Method ${id}`,
            method: map[id],
        }));
    }, [bankingInformation]);

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600">Product ID</span>
                        <input
                            className="input input-bordered rounded-xl border-slate-300 px-3 py-2"
                            value={form.productId}
                            onChange={(e) => onChange("productId", e.target.value)}
                            placeholder="e.g. com.mycompany.myapp"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600">Product Version</span>
                        <input
                            className="input input-bordered rounded-xl border-slate-300 px-3 py-2"
                            value={form.productVersion}
                            onChange={(e) => onChange("productVersion", e.target.value)}
                            placeholder="1.0.0"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm md:col-span-2">
                        <span className="text-slate-600">Bank FinTS URL</span>
                        <input
                            className="input input-bordered rounded-xl border-slate-300 px-3 py-2"
                            value={form.bankUrl}
                            onChange={(e) => onChange("bankUrl", e.target.value)}
                            placeholder="https://.../fints30"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600">Bank ID (BLZ)</span>
                        <input
                            className="input input-bordered rounded-xl border-slate-300 px-3 py-2"
                            value={form.bankId}
                            onChange={(e) => onChange("bankId", e.target.value)}
                            placeholder="e.g. 12030000"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600">User ID</span>
                        <input
                            className="input input-bordered rounded-xl border-slate-300 px-3 py-2"
                            value={form.userId}
                            onChange={(e) => onChange("userId", e.target.value)}
                            placeholder="Online-Banking login"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600">PIN</span>
                        <input
                            type="password"
                            className="input input-bordered rounded-xl border-slate-300 px-3 py-2"
                            value={form.pin}
                            onChange={(e) => onChange("pin", e.target.value)}
                            placeholder="••••••"
                        />
                    </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <button
                        type="button"
                        className="rounded-xl bg-slate-900 text-white px-4 py-2 disabled:opacity-50"
                        disabled={!canStart || busy}
                        onClick={startSession}
                    >
                        {busy ? "Working…" : "Start Session"}
                    </button>
                    <button
                        type="button"
                        className="rounded-xl border border-slate-300 px-4 py-2"
                        onClick={() => {
                            setBankingInformation(null);
                            setBalance(null);
                            setStatements(null);
                            resetTan();
                        }}
                    >
                        Reset
                    </button>
                </div>
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
                        <div className="text-sm text-slate-600">
                            <div className="font-medium">System ID:</div>
                            <div className="font-mono">{bankingInformation.systemId}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="text-slate-600">TAN Method</span>
                                <select
                                    className="rounded-xl border border-slate-300 px-3 py-2"
                                    value={selectedTanMethodId ?? ""}
                                    onChange={(e) =>
                                        setSelectedTanMethodId(Number(e.target.value))
                                    }
                                >
                                    <option value="" disabled>
                                        Select a method
                                    </option>
                                    {tanMethodOptions.map(({ id, name }) => (
                                        <option key={id} value={id}>
                                            {name} (#{id})
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm md:col-span-2">
                                <span className="text-slate-600">TAN Media (if required)</span>
                                <input
                                    className="rounded-xl border border-slate-300 px-3 py-2"
                                    value={selectedTanMedia}
                                    onChange={(e) => setSelectedTanMedia(e.target.value)}
                                    placeholder="e.g. My iPhone"
                                />
                            </label>
                            <button
                                type="button"
                                className="rounded-xl bg-slate-900 text-white px-4 py-2"
                                onClick={selectTan}
                                disabled={busy || !selectedTanMethodId}
                            >
                                Apply TAN Settings
                            </button>
                        </div>

                        {accounts.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <label htmlFor="account-select" className="text-sm text-slate-600">Account:</label>
                                    <select
                                        id="account-select"
                                        className="rounded-xl border border-slate-300 px-3 py-2"
                                        value={accountIdx}
                                        onChange={(e) => setAccountIdx(Number(e.target.value))}
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
                                        onClick={getBalance}
                                        disabled={busy}
                                    >
                                        Get Balance
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
                                        onClick={getStatements}
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
                                                        key={idx}
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
                        ) : (
                            <div className="text-sm text-slate-600">
                                No accounts yet — run Sync after selecting a TAN method.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-slate-600">
                        Start a session to load bank parameters and accounts.
                    </div>
                )}
            </Section>

            {tanChallenge && (
                <Section title="TAN Challenge">
                    <div className="space-y-3">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">
                            {tanChallenge}
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                className="rounded-xl border border-slate-300 px-3 py-2"
                                placeholder="Enter TAN"
                                value={tanInput}
                                onChange={(e) => setTanInput(e.target.value)}
                            />
                            <button
                                type="button"
                                className="rounded-xl bg-slate-900 text-white px-4 py-2"
                                onClick={submitTan}
                                disabled={busy || !tanInput}
                            >
                                Submit TAN
                            </button>
                            <button
                                type="button"
                                className="rounded-xl border px-4 py-2"
                                onClick={resetTan}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Section>
            )}

            {bankingInformation?.bankMessages?.length ? (
                <Section title="Bank Messages">
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                        {bankingInformation.bankMessages.map((m, i) => (
                            <li key={i}>
                                <span className="font-medium">{m.subject || "Message"}:</span>{" "}
                                {m.text}
                            </li>
                        ))}
                    </ul>
                </Section>
            ) : null}

            <footer className="text-xs text-slate-500 text-center">
                This demo stores session data in-memory on the server for convenience.
                Replace with a DB/Redis in production.
            </footer>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Example Next.js App Router backend (app/api/fints/route.ts)
// ---------------------------------------------------------------------------

/*
  Place this file at: /app/api/fints/route.ts (Next.js 13+ App Router)
  Install dependencies: `npm i lib-fints` (or `pnpm add lib-fints`)

  This handler keeps a session per client using a signed cookie. For a quick
  demo it stores the FinTS client & config in-memory. Replace with a proper
  store in production.
*/

// ----- BEGIN: /app/api/fints/route.ts -----

// import { NextRequest, NextResponse } from "next/server";
// import { cookies } from "next/headers";
// import { FinTSClient, FinTSConfig } from "lib-fints";
// import { randomUUID } from "crypto";

// type Session = {
//   client: any; // FinTSClient
//   config: any; // FinTSConfig
//   pending?: { op: "sync" | "balance" | "statements"; accountNumber?: string };
// };
// const sessions = new Map<string, Session>();

// function getOrCreateSession(req: NextRequest): { id: string; session: Session } {
//   const jar = cookies();
//   let sid = jar.get("fints_sid")?.value;
//   if (!sid || !sessions.has(sid)) {
//     sid = randomUUID();
//     jar.set("fints_sid", sid, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
//     sessions.set(sid, { client: null, config: null });
//   }
//   const session = sessions.get(sid)!;
//   return { id: sid, session };
// }

// export async function POST(req: NextRequest) {
//   try {
//     const { id, session } = getOrCreateSession(req);
//     const { action, payload } = await req.json();

//     if (action === "startSession") {
//       const { productId, productVersion, bankUrl, bankId, userId, pin } = payload;
//       const config = FinTSConfig.forFirstTimeUse(productId, productVersion, bankUrl, bankId, userId, pin);
//       const client = new FinTSClient(config);
//       session.client = client;
//       session.config = config;
//       return NextResponse.json({ bankingInformation: null });
//     }

//     if (!session.client) return NextResponse.json({ error: "No active session" }, { status: 400 });

//     if (action === "selectTan") {
//       const { tanMethodId, tanMediaName } = payload || {};
//       if (tanMethodId) session.client.selectTanMethod(Number(tanMethodId));
//       if (tanMediaName) session.client.selectTanMedia(tanMediaName);
//       return NextResponse.json({ bankingInformation: session.config.bankingInformation });
//     }

//     if (action === "synchronize") {
//       const res = await session.client.synchronize();
//       if (res.requiresTan) {
//         session.pending = { op: "sync" };
//         return NextResponse.json(res);
//       }
//       return NextResponse.json({ ...res, data: { bankingInformation: session.config.bankingInformation } });
//     }

//     if (action === "getAccountBalance") {
//       const { accountNumber } = payload || {};
//       const res = await session.client.getAccountBalance(accountNumber);
//       if (res.requiresTan) {
//         session.pending = { op: "balance", accountNumber };
//         return NextResponse.json(res);
//       }
//       return NextResponse.json(res);
//     }

//     if (action === "getAccountStatements") {
//       const { accountNumber } = payload || {};
//       const res = await session.client.getAccountStatements(accountNumber);
//       if (res.requiresTan) {
//         session.pending = { op: "statements", accountNumber };
//         return NextResponse.json(res);
//       }
//       return NextResponse.json(res);
//     }

//     if (action === "submitTan") {
//       const { tan, tanReference, op } = payload || {};
//       if (!session.pending || session.pending.op !== op) {
//         return NextResponse.json({ error: "No pending TAN op" }, { status: 400 });
//       }
//       let res;
//       if (op === "sync") res = await session.client.synchronizeWithTan(tanReference, tan);
//       if (op === "balance") res = await session.client.getAccountBalanceWithTan(session.pending.accountNumber, tanReference, tan);
//       if (op === "statements") res = await session.client.getAccountStatementsWithTan(session.pending.accountNumber, tanReference, tan);
//       session.pending = undefined;
//       return NextResponse.json(res);
//     }

//     return NextResponse.json({ error: "Unknown action" }, { status: 400 });
//   } catch (err: any) {
//     return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
//   }
// }

// ----- END: /app/api/fints/route.ts -----

// Tailwind: ensure your project has Tailwind configured, e.g., with `@tailwind base; @tailwind components; @tailwind utilities;` in your globals.
