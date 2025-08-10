import type { BankingInformation } from "../types/fints";

export interface TanSelectionProps {
    bankingInformation: BankingInformation;
    selectedTanMethodId: number | null;
    selectedTanMedia: string;
    busy: boolean;
    onTanMethodChange: (methodId: number) => void;
    onTanMediaChange: (media: string) => void;
    onSelectTan: () => void;
}

export function TanSelection({
    bankingInformation,
    selectedTanMethodId,
    selectedTanMedia,
    busy,
    onTanMethodChange,
    onTanMediaChange,
    onSelectTan,
}: TanSelectionProps) {
    const tanMethodOptions = (() => {
        const ids = bankingInformation?.bpd?.availableTanMethodIds || [];
        const map = bankingInformation?.bpd?.tanMethods || {};
        return ids.map((id) => ({
            id,
            name: map[id]?.name || `Method ${id}`,
            method: map[id],
        }));
    })();

    return (
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
                        onChange={(e) => onTanMethodChange(Number(e.target.value))}
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
                        onChange={(e) => onTanMediaChange(e.target.value)}
                        placeholder="e.g. My iPhone"
                    />
                </label>
                <button
                    type="button"
                    className="rounded-xl bg-slate-900 text-white px-4 py-2"
                    onClick={onSelectTan}
                    disabled={busy || !selectedTanMethodId}
                >
                    Apply TAN Settings
                </button>
            </div>
        </div>
    );
}
