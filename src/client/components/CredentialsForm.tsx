import type { FinTSForm } from "../types/fints";

export interface CredentialsFormProps {
    form: FinTSForm;
    canStart: boolean;
    busy: boolean;
    onChange: <K extends keyof FinTSForm>(key: K, value: FinTSForm[K]) => void;
    onStartSession: () => void;
    onReset: () => void;
}

export function CredentialsForm({
    form,
    canStart,
    busy,
    onChange,
    onStartSession,
    onReset,
}: CredentialsFormProps) {
    return (
        <>
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
                    onClick={onStartSession}
                >
                    {busy ? "Working…" : "Start Session"}
                </button>
                <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-4 py-2"
                    onClick={onReset}
                >
                    Reset
                </button>
            </div>
        </>
    );
}
