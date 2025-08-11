import { useState } from "react";
import { isDecoupledTanChallenge, isDecoupledTanPending } from "../utils/fintsUtils";
import type { BankAnswer } from "../types/fints";

export interface TanChallengeProps {
    tanChallenge: string;
    tanInput: string;
    busy: boolean;
    onTanInputChange: (tan: string) => void;
    onSubmitTan: () => void;
    onCancel: () => void;
    error?: string | null;
    bankAnswers?: BankAnswer[];
}

export function TanChallenge({
    tanChallenge,
    tanInput,
    busy,
    onTanInputChange,
    onSubmitTan,
    onCancel,
    error,
    bankAnswers,
}: TanChallengeProps) {
    // Use utility function to detect decoupled TAN based on response codes
    const isDecoupledTan = isDecoupledTanChallenge(bankAnswers, tanChallenge);

    const [retryCount, setRetryCount] = useState(0);

    // Check if the error indicates pending approval using response codes
    const isPendingApproval = isDecoupledTanPending(bankAnswers) ||
        (error && (
            error.includes("noch nicht freigegeben") ||
            error.includes("TAN approval still pending") ||
            error.includes("Banking-App frei")
        ));

    const handleDecoupledSubmit = () => {
        if (isPendingApproval) {
            setRetryCount(prev => prev + 1);
        }
        onSubmitTan(); // Try to submit without TAN for decoupled methods
    }; return (
        <div className="space-y-3">
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {tanChallenge}
            </div>

            {isDecoupledTan ? (
                // Decoupled TAN UI (app-based approval)
                <div className="space-y-3">
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
                        <div className="font-medium text-blue-800">📱 App-Freigabe erforderlich</div>
                        <div className="text-blue-700 mt-1">
                            Bitte öffnen Sie Ihre Banking-App und geben Sie die Transaktion frei.
                        </div>
                    </div>

                    {isPendingApproval && (
                        <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm">
                            <div className="font-medium text-orange-800">⏳ Warten auf Freigabe</div>
                            <div className="text-orange-700 mt-1">
                                {error}
                                {retryCount > 0 && ` (Versuch ${retryCount})`}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="rounded-xl bg-blue-600 text-white px-4 py-2"
                            onClick={handleDecoupledSubmit}
                            disabled={busy}
                        >
                            {busy ? "Prüfen..." : (isPendingApproval ? "Erneut prüfen" : "Freigabe prüfen")}
                        </button>
                        <button
                            type="button"
                            className="rounded-xl border px-4 py-2"
                            onClick={onCancel}
                        >
                            Abbrechen
                        </button>
                    </div>

                    <div className="text-xs text-slate-600">
                        💡 Tipp: Nach der Freigabe in der App, klicken Sie "Erneut prüfen"
                    </div>
                </div>
            ) : (
                // Traditional TAN input UI
                <div className="flex items-center gap-3">
                    <input
                        className="rounded-xl border border-slate-300 px-3 py-2"
                        placeholder="TAN eingeben"
                        value={tanInput}
                        onChange={(e) => onTanInputChange(e.target.value)}
                    />
                    <button
                        type="button"
                        className="rounded-xl bg-slate-900 text-white px-4 py-2"
                        onClick={onSubmitTan}
                        disabled={busy || !tanInput}
                    >
                        TAN senden
                    </button>
                    <button
                        type="button"
                        className="rounded-xl border px-4 py-2"
                        onClick={onCancel}
                    >
                        Abbrechen
                    </button>
                </div>
            )}
        </div>
    );
}
