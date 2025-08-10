export interface TanChallengeProps {
    tanChallenge: string;
    tanInput: string;
    busy: boolean;
    onTanInputChange: (tan: string) => void;
    onSubmitTan: () => void;
    onCancel: () => void;
}

export function TanChallenge({
    tanChallenge,
    tanInput,
    busy,
    onTanInputChange,
    onSubmitTan,
    onCancel,
}: TanChallengeProps) {
    return (
        <div className="space-y-3">
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {tanChallenge}
            </div>
            <div className="flex items-center gap-3">
                <input
                    className="rounded-xl border border-slate-300 px-3 py-2"
                    placeholder="Enter TAN"
                    value={tanInput}
                    onChange={(e) => onTanInputChange(e.target.value)}
                />
                <button
                    type="button"
                    className="rounded-xl bg-slate-900 text-white px-4 py-2"
                    onClick={onSubmitTan}
                    disabled={busy || !tanInput}
                >
                    Submit TAN
                </button>
                <button
                    type="button"
                    className="rounded-xl border px-4 py-2"
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
